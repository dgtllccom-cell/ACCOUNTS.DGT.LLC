import fs from "node:fs"; import postgres from "postgres";
const B = "http://localhost:3100";
const CK = fs.readFileSync("scratch/replica-cookies.txt","utf8").split(/\r?\n/).map(l=>l.replace(/^#HttpOnly_/,"")).filter(l=>l&&!l.startsWith("#")&&l.includes("\t")).map(l=>{const p=l.split("\t");return `${p[5]}=${p[6]}`}).join("; ");
const H = { cookie: CK, "content-type": "application/json" };
const j = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t.slice(0,300), _st: r.status }; } };

const sql = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica",{max:1,prepare:false});
// seed a UAE branch + ledgers for the test
const ae = (await sql`SELECT id FROM countries WHERE iso2='AE' AND deleted_at IS NULL LIMIT 1`)[0];
const cb = (await sql`SELECT id FROM country_branches WHERE country_id=${ae.id} AND deleted_at IS NULL LIMIT 1`)[0];
const city = (await sql`SELECT id FROM city_branches WHERE country_id=${ae.id} AND deleted_at IS NULL LIMIT 1`)[0];
const TAG = "APITEST-" + Date.now().toString(36);
const mk = async (code,name,ccy,nb) => (await sql`INSERT INTO ledgers (scope,country_id,code,name,currency,normal_balance,is_active) VALUES ('country',${ae.id}::uuid,${code},${name},${ccy},${nb}::ledger_direction,true) RETURNING id`)[0].id;
const dr = await mk(`${TAG}-PUR`,`${TAG} Purchase`,"AED","debit");
const cr = await mk(`${TAG}-SUP`,`${TAG} Supplier USD`,"USD","credit");
const bank = await mk(`${TAG}-BANK`,`${TAG} Bank`,"AED","debit");

// create PO via API — USD 220,500 @ 3.675
let r = await fetch(`${B}/api/erp/purchases/orders`, { method:"POST", headers:{...H,"idempotency-key":`${TAG}-po`}, body: JSON.stringify({
  countryId: ae.id, countryBranchId: cb.id, cityBranchId: city.id,
  purchaseContractNo: `${TAG}-DSA2025-0908`, purchaseOrderNo: "AUTO",
  purchaseCurrency: "USD", paymentCurrency: "AED", currencyCode: "USD", exchangeRate: 3.675,
  orderTotal: 220500, totalGoodsOriginal: 220500, totalGoodsLocal: 810337.5, totalGoodsUsd: 220500,
  formData: { form: { supplierName: "DALIAN SUNSHINE IMP. & EXP.", purchaseAccountNo: `${TAG}-PUR`, salesAccountNo: `${TAG}-SUP`, supplierAccountNo: `${TAG}-SUP`, goodsEntries:[{item:"Walnut Kernels",qtyNo:45,qtyName:"TON",coursePrice:4900,totalAmount:220500,currency:"USD",exchangeRate:3.675}] } },
}) });
const po = await j(r);
const poId = po?.data?.purchaseOrderId;
console.log("CREATE PO:", r.status, po?.data?.purchaseOrderNo, "id:", poId);

r = await fetch(`${B}/api/erp/purchases/orders/${poId}/transfer`, { method:"POST", headers:{...H,"idempotency-key":`${TAG}-t`}, body: JSON.stringify({ remarks: "replica API multi-currency test" }) });
const tr = await j(r);
console.log("TRANSFER:", r.status, "roz:", tr?.data?.roznamchaEntryId);

// verify accounting
const p = (await sql`SELECT amount, currency_code, exchange_rate, base_currency_amount, original_currency_code FROM purchase_order_payments WHERE purchase_order_id=${poId}::uuid AND kind='booking'`)[0];
console.log("payment row:", JSON.stringify(p));
const lines = await sql`SELECT l.payment_entry_type, l.debit, l.credit, l.currency, g.name led FROM roznamcha_lines l JOIN ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${tr?.data?.roznamchaEntryId}::uuid ORDER BY payment_entry_type`;
for (const x of lines) console.log(`  ${x.payment_entry_type} ${x.led} : Dr ${x.debit} Cr ${x.credit} [${x.currency}]`);
const e = (await sql`SELECT original_currency_code, base_currency_amount FROM roznamcha_entries WHERE id=${tr?.data?.roznamchaEntryId}::uuid`)[0];
const bal = Number(lines[0].debit) === Number(lines[1].credit);
console.log(`RESULT: USD ${p.amount} @ ${p.exchange_rate} = AED ${p.base_currency_amount} | entry orig=${e.original_currency_code} base=${e.base_currency_amount} | DR=CR ${bal} | lines labelled ${lines[0].currency}`);
const OK = Number(p.amount)===220500 && Number(p.exchange_rate)===3.675 && Number(p.base_currency_amount)===810337.5 && bal && lines[0].currency==='AED' && e.original_currency_code==='USD';
console.log(OK ? "✓✓ MULTI-CURRENCY API E2E PASS (USD 220,500 × 3.675 = AED 810,337.50)" : "✗ FAIL");

// cleanup
await sql`SELECT reverse_roznamcha_entry(${tr?.data?.roznamchaEntryId}::uuid, 'cleanup', NULL::uuid)`.catch(()=>{});
await sql`UPDATE purchase_order_payments SET deleted_at=now() WHERE purchase_order_id=${poId}::uuid`;
await sql`DELETE FROM purchase_orders WHERE id=${poId}::uuid`;
await sql`DELETE FROM ledgers WHERE code LIKE ${TAG+'%'}`;
await sql.end();
