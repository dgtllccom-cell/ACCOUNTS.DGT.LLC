/**
 * DEV only - the two live-data repairs, end to end through the real routes and the real screens.
 *   BASE=http://localhost:3555 OUT=<dir> node scripts/dev/two-repairs-e2e.mjs
 *
 * A. Advance payment edited in the bill's currency (the AE-001-0004 case): an advance entered as AED 80,740 (= USD 22,000) is edited in the Edit
 *    dialog to USD 23,250 - the dialog must show USD 22,000 / USD (not AED 80,740), save AED 85,327.50 @ 3.67, keep the audit trail (old payment
 *    soft-deleted, old Roznamcha entry cancelled + a reversal), stamp the Business domain on the new entries, balance the ledger, and the payments
 *    table must show Amount USD 23,250 / Final Amount AED 85,327.50 (not AED 23,250 twice).
 * B. Remaining Payment for a bill with several trucks (AE-001-0007): only the loaded truck is payable = its own goods value (quantity, weight,
 *    contract price) - its allocated advance; a heavier second truck is worth more than the first; payment per loading, part and full; the bill
 *    leaves the list when nothing is payable and comes back when the next truck is loaded; reload keeps the figures.
 * C. A fully loaded single-truck bill (AE-001-0005): its whole outstanding balance (total - the advance actually paid) is payable.
 * Real Production bills are never touched: throw-away bills are cloned from a working DEV order.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3555";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".tmp/two-repairs"; fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok, detail: String(detail).slice(0, 300) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 240) : ""); };
const near = (a, b, e = 0.05) => Math.abs(Number(a) - Number(b)) <= e;

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r0.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")).slice(12);
const cookie = `erp_session=${token}`;
const api = async (method, path, body, key) => {
  const headers = { cookie, "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  const x = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || j?.message || "", code: j?.error?.code };
};

// ── fixture ──
const [src] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0022' and deleted_at is null limit 1`;
if (!src) throw new Error("AE-001-0022 not found in DEV");
const [payable] = await sql`select id from ledgers where code = 'LOADTEST-AE-PAYABLE' limit 1`;
const [bank] = await sql`select id from ledgers where code = 'LOADTEST-AE-BANK' limit 1`;
const RATE = 3.67;
const TAG = "E2ETR-" + String(Date.now()).slice(-6);
const created = [];
const goodsFor = (name, qty, perKg, empty, netKg, price, divide, total) => ({ goodsName: name, goodsId: crypto.randomUUID(), item: name, qtyNo: qty, quantity: qty, qtyName: "CARTONS", qtyKgs: perKg, emptyKgs: empty, netWeight: netKg, grossWeight: netKg + qty * empty, priceType: "P/KGs", divideType: "D/KGs", divideWeight: divide, coursePrice: price, totalAmount: total, currencyType: "USD", purchaseCurrency: "AED", exchangeRate: RATE });
async function makeBill(no, { pct, total, qty, goods }) {
  const id = crypto.randomUUID();
  const fd = {
    form: { paymentType: "Advance Payment", advancePercent: pct, totalAmount: total, currency: "USD", purchaseCurrency: "USD", exchangeRate: RATE, purchaseOrderNo: no, manualBillNumber: no, supplierName: "E2E Supplier" },
    goodsEntries: [goods],
    totals: { totalQuantity: qty, totalAmount: total, grandPrimaryFinal: total, grandFinal: total * RATE },
    workflow: { totalQuantity: qty, loadedQuantity: 0, transferStatus: "transferred" }
  };
  const clone = { ...src, id, purchase_order_no: no, status: "transferred", ledger_posting_status: "draft", payment_status: "pending", currency_code: "USD", purchase_currency: "USD", exchange_rate: RATE,
    order_total: Math.round(total * RATE * 100) / 100, total_goods_original: total, total_goods_usd: total, advance_paid: 0, remaining_paid: 0, credit_amount: 0, remaining_due: total, form_data: sql.json(fd), created_at: new Date(), updated_at: new Date() };
  for (const k of Object.keys(clone)) if (clone[k] === undefined || /serial/i.test(k)) delete clone[k];
  await sql`insert into purchase_orders ${sql(clone)}`;
  created.push(id);
  return { id, no, goods };
}
const payBody = (kind, amount, ccy, extra = {}) => ({ kind, entryDate: new Date().toISOString().slice(0, 10), amount, currencyCode: ccy, exchangeRate: RATE, debitLedgerId: payable.id, creditLedgerId: bank.id, referenceNo: `${TAG}-${Math.random().toString(36).slice(2, 8)}`, ...extra });
const postPay = (bill, body) => api("POST", `/api/erp/purchases/orders/${bill.id}/payments`, body, crypto.randomUUID());
const loadingBody = (bill, container, qty, perKg, empty, netKg) => ({
  countryId: src.country_id, countryBranchId: src.country_branch_id, cityBranchId: src.city_branch_id, purchaseOrderId: bill.id, purchaseOrderNo: bill.no, containerNumber: container,
  loadedContainers: 1, loadedQuantity: qty, netWeight: netKg, grossWeight: netKg + qty * empty, loadingStatus: "loaded",
  reportPayload: { entryCount: 1, loadedQuantity: qty, goodsEntries: [{ goodsName: bill.goods.goodsName, quantityNo: String(qty), oneQtyKgs: String(perKg), oneEmptyKgs: String(empty) }] }
});
const order = async (bill) => (await sql`select advance_paid::float adv, remaining_paid::float rem, remaining_due::float due, payment_status::text ps from purchase_orders where id = ${bill.id}`)[0];
const due = async (bill) => { const r = await api("GET", `/api/erp/purchases/remaining-due?orderNo=${encodeURIComponent(bill.no)}&includeSettled=1`); return (r.j?.data?.bills ?? [])[0] ?? null; };
const inList = async (bill) => ((await api("GET", "/api/erp/purchases/remaining-due")).j?.data?.bills ?? []).some((b) => b.billNo === bill.no);
const dueList = async () => (await api("GET", "/api/erp/purchases/remaining-due")).j?.data?.bills ?? [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const page = await ctx.newPage();
const dialogs = [];
page.on("dialog", async (d) => { dialogs.push(d.message()); await d.accept(); });

async function openRemainingPage() {
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/erp/purchases/remaining-due" && r.status() === 200, { timeout: 150000 }).catch(() => null);
  await page.goto(`${BASE}/dashboard/journal/purchase-order-payment/remaining`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator('[data-testid="rdue-section"]').waitFor({ timeout: 120000 });
  await loaded;
  await page.waitForTimeout(2500);
}
const num = (t) => Number(String(t).replace(/[^0-9.\-]/g, ""));

try {
  // ════════ A. the edit of an advance payment keeps the bill's currency ════════
  const goodsA = goodsFor("WALNUT KERNELS", 2500, 10.1, 0.1, 25000, 4.65, 1, 116250);
  const A = await makeBill(`${TAG}-A4`, { pct: 20, total: 116250, qty: 2500, goods: goodsA });
  const a1 = await postPay(A, payBody("advance", 80740, "AED"));
  check("edit", "[A] the first advance is entered as AED 80,740 (= USD 22,000) and posts", a1.status < 300, `${a1.status} ${a1.msg}`);
  const oa = await order(A);
  check("edit", "[A] the bill shows advance paid USD 22,000", near(oa.adv, 22000, 0.01), String(oa.adv));
  const [pay1] = await sql`select id::text id, roznamcha_entry_id::text rid from purchase_order_payments where purchase_order_id = ${A.id} and kind::text = 'advance' and deleted_at is null`;

  const openDoc = async (bill, mode) => {
    await page.goto(`${BASE}/dashboard/journal/purchase-order-payment/${mode}?purchaseOrderNo=${encodeURIComponent(bill.no)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator('[data-testid="payment-entry-document"]').waitFor({ timeout: 150000 });
    await page.waitForTimeout(2500);
  };
  await openDoc(A, "advance");
  let row = page.locator('[data-testid="ppe-payment-row"]').first();
  await row.waitFor({ timeout: 60000 });
  let cells = (await row.locator("td").allInnerTexts()).map((x) => x.trim());
  check("edit", "[A] the payments table shows Currency USD and Amount 22,000.00, Final Amount (local) 80,740.00 - not the AED figure twice", cells.includes("USD") && cells.some((c) => num(c) === 22000) && cells.some((c) => num(c) === 80740), cells.join(" | "));
  await row.locator('[data-testid="ppe-edit"]').click();
  await page.locator('[data-testid="pem-currency"]:visible').waitFor({ timeout: 30000 });
  const ccyShown = await page.locator('[data-testid="pem-currency"]:visible').inputValue();
  const amtShown = await page.locator('input[type="number"][step="0.01"]:visible').last().inputValue();
  const eqText = (await page.locator('[data-testid="pem-equivalent"]:visible').innerText().catch(() => "")).replace(/\s+/g, " ");
  check("edit", "[A] the Edit dialog shows what was paid in the BILL's currency: USD 22,000 (not AED 80,740)", ccyShown === "USD" && near(amtShown, 22000, 0.01), `${ccyShown} ${amtShown}`);
  check("edit", "[A] … and what that is in the branch currency: = 80,740.00 AED at rate 3.67", /80,740\.00 AED/.test(eqText) && /3\.67/.test(eqText), eqText);
  await page.locator('input[type="number"][step="0.01"]:visible').last().fill("23250");
  const eq2 = (await page.locator('[data-testid="pem-equivalent"]:visible').innerText().catch(() => "")).replace(/\s+/g, " ");
  check("edit", "[A] typing 23250 (USD) shows = 85,327.50 AED", /85,327\.50 AED/.test(eq2), eq2);
  await page.getByRole("button", { name: /Save Changes/ }).click();
  await page.waitForTimeout(12000);
  check("edit", "[A] the edit is saved", dialogs.some((d) => /updated successfully/i.test(d)), dialogs.join(" / "));

  const pays = await sql`select id::text id, amount::float amt, currency_code, exchange_rate::float rate, base_currency_amount::float base, kind::text kind, status::text status, roznamcha_entry_id::text rid, deleted_at, narration from purchase_order_payments where purchase_order_id = ${A.id} and kind::text = 'advance' order by created_at`;
  const oldP = pays.find((p) => p.id === pay1.id), newP = pays.find((p) => p.id !== pay1.id);
  check("edit", "[A] audit trail: the old payment is kept (soft-deleted), not erased", oldP && oldP.deleted_at && near(oldP.amt, 80740, 0.01), JSON.stringify(oldP && { amt: oldP.amt, deleted: !!oldP.deleted_at }));
  check("edit", "[A] the new payment is AED 85,327.50 @ 3.67 (USD 23,250), posted, advance", newP && near(newP.amt, 85327.5, 0.01) && newP.currency_code === "AED" && near(newP.rate, 3.67, 0.0001) && near(newP.base, 85327.5, 0.01) && newP.status === "posted", JSON.stringify(newP && { amt: newP.amt, ccy: newP.currency_code, rate: newP.rate, base: newP.base }));
  const entries = await sql`select re.id::text id, re.status::text status, re.operational_domain, re.journal_no, (select coalesce(sum(debit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = re.id) dr, (select coalesce(sum(credit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = re.id) cr from roznamcha_entries re where re.id = ${pay1.rid}::uuid or re.id = ${newP.rid}::uuid or re.id in (select reversal_roznamcha_entry_id from roznamcha_reversals where original_roznamcha_entry_id = ${pay1.rid}::uuid)`;
  const oldE = entries.find((e) => e.id === pay1.rid), newE = entries.find((e) => e.id === newP.rid), revE = entries.find((e) => e.id !== pay1.rid && e.id !== newP.rid);
  check("edit", "[A] the old Roznamcha entry is cancelled and has a reversal entry (history preserved)", oldE?.status === "cancelled" && !!revE, JSON.stringify(entries.map((e) => [e.journal_no, e.status])));
  check("edit", "[A] the new and the reversal entries carry the Business domain (they used to be stamped with none)", newE?.operational_domain === "business" && revE?.operational_domain === "business", `${newE?.operational_domain} / ${revE?.operational_domain}`);
  check("edit", "[A] every entry balances (DR = CR) and the new one is AED 85,327.50", entries.every((e) => near(e.dr, e.cr, 0.005)) && near(newE?.dr, 85327.5, 0.01), JSON.stringify(entries.map((e) => [e.dr, e.cr])));
  const ob = await order(A);
  check("edit", "[A] the bill: advance paid USD 23,250 = the required 20 % - status partial, due 93,000", near(ob.adv, 23250, 0.01) && ob.ps === "partial" && near(ob.due, 93000, 0.01), JSON.stringify(ob));
  const noDup = await sql`select count(*)::int n from purchase_order_payments where purchase_order_id = ${A.id} and kind::text = 'advance' and deleted_at is null`;
  check("edit", "[A] exactly one live advance payment - nothing duplicated", noDup[0].n === 1, String(noDup[0].n));
  await openDoc(A, "advance"); // reload
  row = page.locator('[data-testid="ppe-payment-row"]').first();
  await row.waitFor({ timeout: 60000 });
  cells = (await row.locator("td").allInnerTexts()).map((x) => x.trim());
  check("edit", "[A] after reload the table shows USD | 23,250.00 | 3.6700 | Final Amount 85,327.50", cells.includes("USD") && cells.some((c) => num(c) === 23250) && cells.some((c) => near(num(c), 85327.5, 0.01)) && !cells.some((c) => num(c) === 80740), cells.join(" | "));

  // ════════ B. a bill with several trucks: only the loaded truck is payable ════════
  const goodsB = goodsFor("WALNUT KERNELS", 22500, 10.1, 0.1, 225000, 5.15, 1, 1158750);
  const B = await makeBill(`${TAG}-R7`, { pct: 10, total: 1158750, qty: 22500, goods: goodsB });
  check("multi", "[B] a bill whose advance is not paid is not in the list", !(await due(B)));
  await postPay(B, payBody("advance", 367000, "AED"));
  await postPay(B, payBody("advance", 58261.25, "AED"));
  const ob0 = await order(B);
  check("multi", "[B] the required advance USD 115,875 (10 %) is paid", near(ob0.adv, 115875, 0.01), String(ob0.adv));
  check("multi", "[B] nothing is loaded yet - the bill is not waiting for a Remaining Payment", !(await due(B)));
  const L1 = await api("POST", "/api/erp/purchases/loading-records", loadingBody(B, `${TAG}-T1`, 2250, 10.1, 0.1, 22500));
  check("multi", "[B] truck 1 is loaded: 2,250 of 22,500 cartons, 22,500 kg net", L1.status === 201, `${L1.status} ${L1.msg}`);
  const loadsB = await sql`select id::text id from purchase_loading_records where purchase_order_id = ${B.id} and deleted_at is null and coalesce(loaded_quantity,0) > 0 order by created_at`;
  let d = await due(B);
  check("multi", "[B] the bill is listed: total 22,500 / loaded 2,250 / balance 20,250", d && d.totalQuantity === 22500 && d.loadedQuantity === 2250 && d.balanceQuantity === 20250, JSON.stringify(d && [d.totalQuantity, d.loadedQuantity, d.balanceQuantity]));
  check("multi", "[B] truck 1 is worth 22,500 kg × 5.15 = 115,875; its advance share is 11,587.50; payable 104,287.50 (not the whole bill)", d && near(d.loadings[0]?.value, 115875, 0.01) && near(d.loadings[0]?.advanceAllocated, 11587.5, 0.01) && near(d.payableNow, 104287.5, 0.01), JSON.stringify(d?.loadings?.[0]));
  check("multi", "[B] the bill figures: total 1,158,750, advance 115,875 of 115,875, total paid 115,875, outstanding 1,042,875", d && near(d.billTotal, 1158750, 0.01) && near(d.advancePaid, 115875, 0.01) && near(d.advanceRequired, 115875, 0.01) && near(d.totalPaid, 115875, 0.01) && near(d.outstanding, 1042875, 0.01), JSON.stringify(d && [d.billTotal, d.advancePaid, d.advanceRequired, d.totalPaid, d.outstanding]));

  await openRemainingPage();
  const rowB = page.locator(`[data-testid="rdue-row-${B.no}"]`);
  check("multi", "[B] the Remaining Payment page lists the original bill", await rowB.count() === 1);
  const payableTxt = await page.locator(`[data-testid="rdue-payable-${B.no}"]`).innerText();
  check("multi", "[B] … with Payable now 104,287.50 USD (and its AED equivalent)", num(payableTxt.split("USD")[0]) === 104287.5 && /≈/.test(payableTxt), payableTxt.replace(/\s+/g, " "));
  check("multi", "[B] … loaded 2,250 of 22,500", /2,250/.test(await rowB.innerText()) && /22,500/.test(await rowB.innerText()));
  await page.locator(`[data-testid="rdue-toggle-${B.no}"]`).click();
  const loadRow = page.locator(`[data-testid="rdue-loading-${loadsB[0].id}"]`);
  const lt = (await loadRow.innerText()).replace(/\s+/g, " ");
  check("multi", "[B] the truck's line shows value 115,875.00, advance 11,587.50, payable 104,287.50", /115,875\.00 USD/.test(lt) && /11,587\.50 USD/.test(lt) && /104,287\.50 USD/.test(lt), lt);
  await page.screenshot({ path: `${OUT}/remaining-multi-truck.png` });
  await page.locator(`[data-testid="rdue-pay-loading-${loadsB[0].id}"]`).click();
  await page.locator('[data-testid="payment-entry-document"]').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some((e) => Math.abs(Number(e.value) - 104287.5) < 0.01), null, { timeout: 60000 }).catch(() => undefined);
  const vals = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  fs.writeFileSync(`${OUT}/prefill-diag.json`, JSON.stringify({ allInputs: await page.locator("input").evaluateAll((els) => els.map((e) => ({ v: e.value, t: e.type, n: e.name || e.id || e.getAttribute("data-testid") || "" }))), slot: (await page.locator("#ppe-entry-slot").innerText().catch(() => "")).slice(0, 1500), url: page.url() }, null, 1));
  await page.screenshot({ path: `${OUT}/prefill-after-click.png`, fullPage: true });
  check("multi", "[B] Pay this loading opens the bill's payment document with the amount prefilled 104,287.50", vals.some((v) => Math.abs(Number(v) - 104287.5) < 0.01), vals.filter(Boolean).slice(0, 12).join(" | "));

  const over = await postPay(B, payBody("remaining", 104288, "USD", { typeDetails: { loadingRecordId: loadsB[0].id } }));
  check("multi", "[B] paying more than the truck owes (USD 104,288) is refused", over.status === 409, `${over.status} ${over.msg}`);
  const wholeBill = await postPay(B, payBody("remaining", 500000, "USD", { typeDetails: {} }));
  check("multi", "[B] paying USD 500,000 against the whole bill is refused - goods not loaded are not payable", wholeBill.status === 409, `${wholeBill.status} ${wholeBill.msg}`);
  const part = await postPay(B, payBody("remaining", 50000, "USD", { typeDetails: { loadingRecordId: loadsB[0].id } }));
  check("multi", "[B] a part payment of USD 50,000 against truck 1 posts", part.status < 300, `${part.status} ${part.msg}`);
  d = await due(B);
  check("multi", "[B] payable now falls to 54,287.50 and the figure survives a reload", d && near(d.payableNow, 54287.5, 0.01), String(d?.payableNow));
  await openRemainingPage();
  check("multi", "[B] … the page shows 54,287.50 after reload", num((await page.locator(`[data-testid="rdue-payable-${B.no}"]`).innerText()).split("USD")[0]) === 54287.5);
  const rest = await postPay(B, payBody("remaining", 54287.5, "USD", { typeDetails: { loadingRecordId: loadsB[0].id } }));
  check("multi", "[B] the rest of truck 1 (USD 54,287.50) posts", rest.status < 300, `${rest.status} ${rest.msg}`);
  check("multi", "[B] truck 1 is settled: the bill leaves the list (the other trucks are not loaded)", !(await inList(B)));
  await openRemainingPage();
  check("multi", "[B] … and the page no longer lists it", await page.locator(`[data-testid="rdue-row-${B.no}"]`).count() === 0);

  const L2 = await api("POST", "/api/erp/purchases/loading-records", loadingBody(B, `${TAG}-T2`, 2250, 10.5, 0.1, 23400));
  check("multi", "[B] truck 2 is loaded: 2,250 cartons but 23,400 kg net (heavier)", L2.status === 201, `${L2.status} ${L2.msg}`);
  d = await due(B);
  const t2 = d?.loadings?.find((l) => l.id !== loadsB[0].id);
  check("multi", "[B] the bill is released again for truck 2 only: value 23,400 × 5.15 = 120,510; advance 12,051; payable 108,459 - not the same as truck 1", t2 && near(t2.value, 120510, 0.01) && near(t2.advanceAllocated, 12051, 0.01) && near(t2.outstanding, 108459, 0.01) && near(d.payableNow, 108459, 0.01), JSON.stringify(t2));
  check("multi", "[B] … loaded 4,500, balance 18,000; truck 1 still shows paid", d && d.loadedQuantity === 4500 && d.balanceQuantity === 18000 && d.loadings.find((l) => l.id === loadsB[0].id)?.complete === true, JSON.stringify(d && [d.loadedQuantity, d.balanceQuantity]));
  const p2 = await postPay(B, payBody("remaining", 108459, "USD", { typeDetails: { loadingRecordId: t2.id } }));
  check("multi", "[B] truck 2 is paid in full", p2.status < 300, `${p2.status} ${p2.msg}`);
  check("multi", "[B] truck 2 cannot be paid twice", (await postPay(B, payBody("remaining", 1, "USD", { typeDetails: { loadingRecordId: t2.id } }))).status === 409);
  const ob2 = await order(B);
  check("multi", "[B] bill totals: remaining paid 212,746.50 (= 104,287.50 + 108,459), still due 830,128.50", near(ob2.rem, 212746.5, 0.02) && near(ob2.due, 1158750 - 115875 - 212746.5, 0.02), JSON.stringify(ob2));
  const bVouchers = await sql`select re.id::text id, (select coalesce(sum(debit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = re.id) dr, (select coalesce(sum(credit),0)::float from roznamcha_lines l where l.roznamcha_entry_id = re.id) cr, re.operational_domain from roznamcha_entries re join purchase_order_payments p on p.roznamcha_entry_id = re.id where p.purchase_order_id = ${B.id} and p.deleted_at is null and p.kind::text = 'remaining'`;
  check("multi", "[B] 3 Remaining vouchers (50,000 + 54,287.50 + 108,459), each balanced, Business domain, none duplicated", bVouchers.length === 3 && bVouchers.every((v) => near(v.dr, v.cr, 0.005) && v.operational_domain === "business"), JSON.stringify(bVouchers.map((v) => [v.dr, v.cr, v.operational_domain])));

  // ════════ C. one truck, fully loaded: the whole outstanding balance ════════
  const goodsC = goodsFor("Cashew Kernel", 1300, 20.2, 0.2, 26000, 148.75, 20, 193375);
  const C = await makeBill(`${TAG}-R5`, { pct: 10, total: 193375, qty: 1300, goods: goodsC });
  await postPay(C, payBody("advance", 71998.06, "AED"));
  const oc = await order(C);
  check("single", "[C] advance paid USD 19,618 (required 19,337.50 - paid slightly more)", near(oc.adv, 19618, 0.01), String(oc.adv));
  const LC = await api("POST", "/api/erp/purchases/loading-records", loadingBody(C, `${TAG}-T5`, 1300, 20.2, 0.2, 26000));
  check("single", "[C] the single truck is loaded: 1,300 of 1,300", LC.status === 201, `${LC.status} ${LC.msg}`);
  const dc = await due(C);
  check("single", "[C] the whole outstanding balance is payable: 193,375 − 19,618 = 173,757; loaded 1,300, balance 0", dc && near(dc.payableNow, 173757, 0.01) && dc.loadedQuantity === 1300 && dc.balanceQuantity === 0 && near(dc.outstanding, 173757, 0.01), JSON.stringify(dc && [dc.payableNow, dc.loadedQuantity, dc.balanceQuantity, dc.outstanding]));
  await openRemainingPage();
  const payC = await page.locator(`[data-testid="rdue-payable-${C.no}"]`).innerText();
  check("single", "[C] the page lists it with Payable now 173,757.00 USD", num(payC.split("USD")[0]) === 173757, payC.replace(/\s+/g, " "));
  const lcId = (await sql`select id::text id from purchase_loading_records where purchase_order_id = ${C.id} and deleted_at is null and coalesce(loaded_quantity, 0) > 0 limit 1`)[0].id;
  const fullC = await postPay(C, payBody("remaining", 173757, "USD", { typeDetails: { loadingRecordId: lcId } }));
  check("single", "[C] paid in full - USD 173,757", fullC.status < 300, `${fullC.status} ${fullC.msg}`);
  const oc2 = await order(C);
  check("single", "[C] the bill is completed: due 0, status completed", near(oc2.due, 0, 0.02) && oc2.ps === "completed", JSON.stringify(oc2));
  check("single", "[C] and it leaves the list", !(await inList(C)));

  // ════════ print: the bill's payment document / receipt carries the right figures ════════
  await openDoc(C, "remaining");
  const row0Ready = async () => { await page.locator('[data-testid="ppe-payment-row"]').first().waitFor({ timeout: 90000 }).catch(() => undefined); await page.waitForTimeout(1500); };
  await row0Ready();
  await page.locator('[data-testid="ppe-print"]').click();
  const frameEl = await page.waitForSelector("iframe", { timeout: 90000 }).catch(() => null);
  const pframe = frameEl ? await frameEl.contentFrame() : null;
  if (pframe) {
    await pframe.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(2500);
    const pt = (await pframe.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    fs.writeFileSync(`${OUT}/print-C.txt`, pt);
    check("print", "[print] the printed payment document names the bill and carries both payments (USD 19,618 advance, USD 173,757 remaining)", pt.includes(C.no) && /173,757/.test(pt) && /19,618/.test(pt), pt.slice(0, 200));
    check("print", "[print] it does not print the branch-currency figure as a bill-currency amount (no 'USD 637,' / 'USD 71,998')", !/USD\s*637,\d{3}/.test(pt) && !/USD\s*71,998/.test(pt));
    await page.keyboard.press("Escape").catch(() => undefined);
  } else {
    check("print", "[print] the print preview opened", false, "no preview iframe");
  }
} catch (e) {
  check("harness", "unexpected error", false, String(e?.stack || e).slice(0, 400));
} finally {
  await browser.close().catch(() => undefined);
  // throw-away bills only (never real ones)
  for (const id of created) {
    await sql`update purchase_orders set deleted_at = now() where id = ${id} and purchase_order_no like 'E2ETR-%'`.catch(() => undefined);
  }
  await sql.end().catch(() => undefined);
}
const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
const groups = {};
for (const r of results) { groups[r.group] ??= { pass: 0, fail: 0 }; groups[r.group][r.ok ? "pass" : "fail"]++; }
console.log(`\n${pass} PASS / ${fail} FAIL`, JSON.stringify(groups));
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ pass, fail, groups, results }, null, 1));
process.exit(fail ? 1 : 0);
