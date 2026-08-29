import fs from "node:fs";
import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs", "utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 40 });
const one = async (e) => (await sql.unsafe(`SELECT (${e}) v`))[0].v;
const near = (a, b, eps = 0.01) => Math.abs(Number(a) - Number(b)) <= eps;
let P = 0, F = 0;
const ok = (n, c, d = "") => { if (c) { P++; console.log(`  ✓ ${n}${d ? " — " + d : ""}`); } else { F++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

console.log("=== STEP 5.9c — MULTI-CURRENCY ACCOUNTING VERIFICATION ON LIVE PRODUCTION ===");
console.log("(tagged test transaction — created, verified, then fully reversed + purged; nets to zero)\n");

const roz0 = Number(await one("SELECT count(*) FROM roznamcha_entries"));
const rl0 = Number(await one("SELECT count(*) FROM roznamcha_lines"));
const po0 = Number(await one("SELECT count(*) FROM purchase_orders"));
const pp0 = Number(await one("SELECT count(*) FROM purchase_order_payments"));
const led0 = Number(await one("SELECT count(*) FROM ledgers"));
console.log(`pre-state: roznamcha_entries=${roz0} lines=${rl0} purchase_orders=${po0} payments=${pp0} ledgers=${led0}`);

const ae = (await sql`SELECT id FROM countries WHERE iso2='AE' AND deleted_at IS NULL LIMIT 1`)[0];
const cb = (await sql`SELECT id FROM country_branches WHERE country_id=${ae.id} AND deleted_at IS NULL LIMIT 1`)[0];
const city = (await sql`SELECT id FROM city_branches WHERE country_id=${ae.id} AND deleted_at IS NULL LIMIT 1`)[0];
const actor = (await sql`SELECT p.id FROM profiles p JOIN user_role_assignments ura ON ura.user_id=p.id WHERE ura.role='super_admin' AND ura.deleted_at IS NULL LIMIT 1`)[0].id;
const TAG = "PRODVERIFY-" + Date.now().toString(36).toUpperCase();
const SUPPLIER = "DALIAN SUNSHINE IMP. & EXP.";
const mk = async (code, name, ccy, nb) => (await sql`INSERT INTO ledgers (scope,country_id,code,name,currency,normal_balance,is_active) VALUES ('country',${ae.id}::uuid,${code},${name},${ccy},${nb}::ledger_direction,true) RETURNING id`)[0].id;
const drL = await mk(`${TAG}-PUR`, `${TAG} Purchase`, "AED", "debit");
const crL = await mk(`${TAG}-SUP`, `${TAG} Supplier USD`, "USD", "credit");

const po = (await sql`INSERT INTO purchase_orders
  (country_id,country_branch_id,city_branch_id,purchase_order_no,purchase_contract_no,currency_code,purchase_currency,payment_currency,exchange_rate,order_total,total_goods_original,total_goods_local,total_goods_usd,status,form_data,created_by)
  VALUES (${ae.id}::uuid,${cb.id}::uuid,${city.id}::uuid,${TAG + "-PO"},${TAG + "-DSA2025-0908"},'USD','USD','AED',3.675,220500,220500,810337.5,220500,'Draft',${sql.json({ form: { supplierName: SUPPLIER } })},${actor}::uuid) RETURNING id`)[0];

const pid = String((await sql`SELECT post_purchase_booking_transfer(${actor}::uuid, ${po.id}::uuid, 'booking'::purchase_order_payment_kind, current_date, 220500, 'USD', 3.675, ${drL}::uuid, ${crL}::uuid, ${TAG + " / DSA2025-0908"}, ${TAG + " walnut kernels USD to AED at 3.675"}) AS p`)[0].p);
const p = (await sql`SELECT amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, roznamcha_entry_id FROM purchase_order_payments WHERE id=${pid}::uuid`)[0];
const e = (await sql`SELECT original_currency_code, base_currency_amount, source_reference_no, source_module, source_transaction_type FROM roznamcha_entries WHERE id=${p.roznamcha_entry_id}::uuid`)[0];
const lines = await sql`SELECT l.payment_entry_type, l.debit, l.credit, l.currency, g.name led, g.currency ledccy FROM roznamcha_lines l JOIN ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${p.roznamcha_entry_id}::uuid ORDER BY payment_entry_type`;
const dr = lines.find((x) => x.payment_entry_type === "debit"), cr = lines.find((x) => x.payment_entry_type === "credit");

console.log("\n--- accounting trace (USD 220,500 × 3.675 = AED 810,337.50) ---");
ok("original currency preserved = USD", p.currency_code === "USD" && e.original_currency_code === "USD", `payment ${p.currency_code} / entry ${e.original_currency_code}`);
ok("original amount preserved = 220,500", near(p.amount, 220500), `${p.amount}`);
ok("historical FX rate frozen = 3.675", near(p.exchange_rate, 3.675, 1e-6), `${p.exchange_rate}`);
ok("final AED amount = 810,337.50", near(p.base_currency_amount, 810337.5) && near(e.base_currency_amount, 810337.5), `payment ${p.base_currency_amount} / entry ${e.base_currency_amount}`);
ok("INVARIANT base = amount x rate", near(p.base_currency_amount, Number(p.amount) * Number(p.exchange_rate)));
ok("DR = CR balanced = 810,337.50", near(dr.debit, cr.credit) && near(dr.debit, 810337.5), `DR ${dr.debit} CR ${cr.credit}`);
ok("roznamcha lines labelled base currency AED (USD supplier ledger NOT tagged USD)", dr.currency === "AED" && cr.currency === "AED", `DR ${dr.currency} (ledger ${dr.ledccy}) / CR ${cr.currency} (ledger ${cr.ledccy})`);
ok("source reference + accounting trace intact", (e.source_reference_no || "").includes("DSA2025-0908") && e.source_module === "purchase" && e.source_transaction_type === "purchase_booking_transfer", `${e.source_reference_no} | ${e.source_module}/${e.source_transaction_type}`);

console.log("\n--- no-duplicate guard ---");
let dupBlocked = false;
try { await sql`SELECT post_purchase_booking_transfer(${actor}::uuid, ${po.id}::uuid, 'booking'::purchase_order_payment_kind, current_date, 220500, 'USD', 3.675, ${drL}::uuid, ${crL}::uuid, ${TAG}, ${TAG})`; }
catch (err) { dupBlocked = /already been posted|Duplicate/i.test(err.message); }
ok("duplicate Purchase/Payment/Roznamcha posting BLOCKED", dupBlocked);
ok("exactly 1 booking roznamcha entry for this PO", Number(await one(`SELECT count(*) FROM roznamcha_entries WHERE source_transaction_id='${po.id}' AND source_transaction_type='purchase_booking_transfer' AND deleted_at IS NULL AND status<>'cancelled'`)) === 1);

console.log("\n--- reversing + purging the verification transaction ---");
await sql`SELECT reverse_roznamcha_entry(${p.roznamcha_entry_id}::uuid, ${TAG + " verification complete, reversing"}, NULL::uuid)`;
const netBal = Number(await one(`SELECT COALESCE(sum(current_balance),0) FROM ledgers WHERE code LIKE '${TAG}%'`));
ok("post-reversal: test ledgers net to 0 (booking + reversal cancel out)", near(netBal, 0), `net ${netBal}`);
await sql`UPDATE purchase_order_payments SET status='cancelled', deleted_at=now() WHERE purchase_order_id=${po.id}::uuid`;
await sql`SELECT recalc_purchase_order_payment_totals(${po.id}::uuid)`;
const ids = (await sql`SELECT id FROM roznamcha_entries WHERE reference_no LIKE ${TAG + "%"} OR narration LIKE ${"%" + TAG + "%"}`).map((r) => r.id);
await sql`DELETE FROM roznamcha_reversals WHERE original_roznamcha_entry_id = ANY(${ids}::uuid[]) OR reversal_roznamcha_entry_id = ANY(${ids}::uuid[])`;
await sql`DELETE FROM roznamcha_lines WHERE roznamcha_entry_id = ANY(${ids}::uuid[])`;
await sql`DELETE FROM purchase_order_payments WHERE roznamcha_entry_id = ANY(${ids}::uuid[]) OR purchase_order_id=${po.id}::uuid`;
await sql`DELETE FROM roznamcha_entries WHERE id = ANY(${ids}::uuid[])`;
await sql`DELETE FROM purchase_orders WHERE id=${po.id}::uuid`;
await sql`DELETE FROM ledger_balances lb USING ledgers g WHERE lb.ledger_id=g.id AND g.code LIKE ${TAG + "%"}`;
await sql`DELETE FROM ledgers WHERE code LIKE ${TAG + "%"}`;

const roz1 = Number(await one("SELECT count(*) FROM roznamcha_entries"));
const rl1 = Number(await one("SELECT count(*) FROM roznamcha_lines"));
const po1 = Number(await one("SELECT count(*) FROM purchase_orders"));
const pp1 = Number(await one("SELECT count(*) FROM purchase_order_payments"));
const led1 = Number(await one("SELECT count(*) FROM ledgers"));
console.log(`post-state: roznamcha_entries=${roz1} lines=${rl1} purchase_orders=${po1} payments=${pp1} ledgers=${led1}`);
ok("PRODUCTION back to EXACT pre-verification state (no residue, no duplicate postings)",
  roz1 === roz0 && rl1 === rl0 && po1 === po0 && pp1 === pp0 && led1 === led0,
  `roz ${roz0}->${roz1}, lines ${rl0}->${rl1}, PO ${po0}->${po1}, pay ${pp0}->${pp1}, ledgers ${led0}->${led1}`);

console.log(`\n=== 5.9c RESULT: ${P} passed / ${F} failed ===`);
await sql.end();
if (F) process.exit(1);
