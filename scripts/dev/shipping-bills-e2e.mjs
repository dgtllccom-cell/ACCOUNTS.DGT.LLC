/**
 * DEV-only Task B (bills): the Chaman Shipping Branch Admin works the three bill types inside its own branch scope.
 *   Customer Bill | Truck Expense Bill | Truck Freight / Rent Bill   - create / view / edit / save (print + PDF are the existing
 *   report engines on the same data; the bill screens are checked by the direct-URL matrix).
 *   BASE=http://127.0.0.1:3540 node scripts/dev/shipping-bills-e2e.mjs
 * Acts as the REAL DEV user chaman.shipping@dgt.llc through dev-session { userId } (live assignment + permission set, no password).
 */
import { IDS, tally } from "./_rbac-lib.mjs";
import { loginAsUser, lookupUserId } from "./_rbac-users.mjs";

const T = tally();
const chaman = await loginAsUser(await lookupUserId("chaman.shipping@dgt.llc"));
const quetta = await loginAsUser(await lookupUserId("quetta.accountant@dgt.llc"));
const stamp = Date.now().toString(36).toUpperCase();
const today = new Date().toISOString().slice(0, 10);
const line = (n, d) => ({ rowSerial: n, details: d, qty: 1, unitPrice: 1500, amount: 1500, currency: "PKR", operation: "*", exchangeRate: 1, finalAmount: 1500, taxOn: false, taxPct: 0, taxAmt: 0, grandAmount: 1500 });

for (const [label, title] of [["Truck Expense Bill", "truck_expenses"], ["Truck Freight / Rent Bill", "truck_freight_rent"]]) {
  const save = await chaman.req("POST", "/api/erp/expenses", { header: { billSerial: "AUTO", branch: IDS.CHAMAN_SHIP, billDate: today, billMode: "new", billTitle: title, referenceNo: `E2E-${stamp}` }, entries: [line(1, `[E2E TEST] ${label} ${stamp}`)] });
  T.check(`${label}: Chaman saves a new bill`, save.status === 200 && Boolean(save.json?.billId), `HTTP ${save.status} ${JSON.stringify(save.json).slice(0, 140)}`);
  const list = (await chaman.get(`/api/erp/expenses?category=${title}&limit=100`)).json?.bills ?? [];
  const mine = list.find((x) => x.id === save.json?.billId);
  T.check(`${label}: it is listed (view) for its category`, Boolean(mine) && mine.expenses_bill_lines?.length === 1, `${list.length} bills in category`);
  const edit = await chaman.req("POST", "/api/erp/expenses", { header: { id: save.json?.billId, billSerial: mine?.serial_no ?? "AUTO", branch: IDS.CHAMAN_SHIP, billDate: today, billMode: "new", billTitle: title, referenceNo: `E2E-${stamp}-EDIT` }, entries: [line(1, `[E2E TEST] ${label} edited ${stamp}`), line(2, "second line")] });
  const after = ((await chaman.get(`/api/erp/expenses?category=${title}&limit=100`)).json?.bills ?? []).find((x) => x.id === save.json?.billId);
  T.check(`${label}: edit saves (2 lines, new reference)`, edit.status === 200 && after?.expenses_bill_lines?.length === 2 && after?.reference_no === `E2E-${stamp}-EDIT`, `HTTP ${edit.status} lines=${after?.expenses_bill_lines?.length}`);
  const other = await chaman.req("POST", "/api/erp/expenses", { header: { billSerial: "AUTO", branch: IDS.QUETTA, billDate: today, billMode: "new", billTitle: title }, entries: [line(1, "out of scope")] });
  T.check(`${label}: another branch (Quetta) is refused`, other.status === 403, `HTTP ${other.status}`);
  const q = await quetta.get(`/api/erp/expenses?category=${title}&limit=100`);
  T.check(`${label}: a Quetta Business user cannot see Chaman's bills`, q.status === 403 || !(q.json?.bills ?? []).some((x) => x.id === save.json?.billId), `HTTP ${q.status}`);
}

const cb = await chaman.get("/api/erp/clearing-agent/customer-bill");
T.check("Customer Bill: Chaman lists customer bills", cb.status === 200, `HTTP ${cb.status}`);
const cbq = await quetta.get("/api/erp/clearing-agent/customer-bill");
T.check("Customer Bill: a Business user is refused", cbq.status === 403, `HTTP ${cbq.status}`);
process.exit(T.summary() ? 0 : 1);
