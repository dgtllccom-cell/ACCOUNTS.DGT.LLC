/**
 * DEV only - Purchase Journal Booking Stock (issue #38) against the real DEV database, read-only.
 *   BASE=http://localhost:3541 node scripts/dev/purchase-journal-booking-e2e.mjs
 * Proves on real bills: the stage invariant per unit, panel totals = the canonical Stock Journal rows, the SAME server scope as the canonical
 * journal for every role, the country / branch drill-down, the bill search, no Local Purchase and no payment figure in the register.
 */
import { IDS, PERSONAS, login, client, tally } from "./_rbac-lib.mjs";

const T = tally();
const c = {};
for (const k of ["global_super", "pk_country_biz", "quetta_biz", "deira_biz", "chaman_ship"]) c[k] = client(await login(PERSONAS[k].body));
const data = (r) => r.json?.data ?? null;
const EPS = 0.01;
const add = (t, q) => { for (const [u, v] of Object.entries(q ?? {})) t[u] = (t[u] ?? 0) + v; return t; };
const same = (a, b) => [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].every((u) => Math.abs((a?.[u] ?? 0) - (b?.[u] ?? 0)) <= EPS);
const bills = async (who, qs = "") => c[who].get(`/api/erp/inventory/journal-stock?view=bills&limit=2000${qs}`);
const rows = async (who) => c[who].get("/api/erp/inventory/journal-stock?view=rows&sourceType=purchase_booking&stage=all&limit=2000");
// unit normalization matches lib/stock-journal/booking-register.ts unitOf
const UA = { CARTONS: "CARTON", CTN: "CARTON", CTNS: "CARTON", BAGS: "BAG", BALES: "BALE", BOXES: "BOX", BX: "BOX", PIECES: "PCS", PIECE: "PCS", PC: "PCS", KGS: "KG", KILOGRAM: "KG", KILOGRAMS: "KG", TONS: "TON", TONNES: "TON", TONNE: "TON", DRUMS: "DRUM", SACKS: "SACK", CASES: "CASE", PACKS: "PACK", ROLLS: "ROLL" };
const unitOf = (u) => { const t = String(u ?? "").trim().replace(/\s+/g, " ").toUpperCase(); return t ? (UA[t] ?? t) : "-"; };

const sa = await bills("global_super");
const d = data(sa);
T.check("Super Admin: the register answers", sa.status === 200 && Array.isArray(d?.bills), `${sa.status} bills=${d?.bills?.length}`);
const all = d?.bills ?? [];
T.check("real Purchase Booking bills are listed", all.length > 0, `${all.length}`);
T.check("no Local Purchase bill appears", all.every((b) => !/^LP-/.test(b.purchaseNo)));
T.check("no payment figure anywhere in the register", !JSON.stringify(d).includes('"payment"') && !JSON.stringify(d).includes("paymentHold"));

// stage invariant on every real bill (bills loaded beyond their booking are reported, not netted)
let checked = 0; const broken = [];
for (const b of all) {
  const over = Object.entries(b.loaded).some(([u, v]) => v > (b.booked[u] ?? 0) + EPS);
  if (over) continue;
  checked++;
  const parts = add(add(add(add(add(add({}, b.notLoaded), b.inTransit), b.awaiting), b.confirmed), b.damaged), b.shortage);
  if (!same(parts, b.booked)) broken.push(b.purchaseNo);
}
T.check(`booked = not loaded + in transit + awaiting + confirmed + damaged + shortage (per unit) on every real bill`, broken.length === 0, `${checked} bills checked, broken: ${broken.slice(0, 5).join(", ")}`);
T.check("pending = not loaded + awaiting confirmation on every bill", all.every((b) => same(b.pending, add(add({}, b.notLoaded), b.awaiting))));
T.check("received (good) = awaiting + confirmed on every bill", all.every((b) => same(b.received, add(add({}, b.awaiting), b.confirmed))));
T.check("entries are numbered <Purchase No>-01, -02 … in order", all.every((b) => b.entries.every((e, i) => e.entryNo === `${b.purchaseNo}-${String(i + 1).padStart(2, "0")}`)));
T.check("every entry carries its truck/container, receiving and confirmation state", all.every((b) => b.entries.every((e) => typeof e.receiving === "string" && typeof e.confirmation === "string" && "truckOrContainer" in e && "transportMode" in e)));

// panels = the sum of the bills = the canonical Stock Journal rows
const p = d.panels;
T.check("Purchase Summary bill count = bills listed", p.purchase.bills === all.length, `${p.purchase.bills} / ${all.length}`);
T.check("Purchase Summary booked = sum of bills (per unit)", same(p.purchase.booked, all.reduce((t, b) => add(t, b.booked), {})));
const rr = await rows("global_super");
const stage = (st) => (data(rr)?.rows ?? []).filter((r) => st.includes(r.stage)).reduce((t, r) => add(t, { [unitOf(r.unit)]: r.quantity }), {});
T.check("In Transit = the canonical journal's transit rows", same(p.confirm.inTransit.qty, stage(["transit"])));
T.check("Confirmed Stock = the canonical journal's available + reserved + sold rows", same(p.confirm.confirmed.qty, stage(["available", "reserved", "sold"])));
T.check("Pending (not loaded) = the canonical journal's booking rows", same(p.confirm.notLoaded.qty, stage(["booking"])));
T.check("Pending (awaiting confirmation) = the canonical journal's receiving + ready rows", same(p.confirm.awaiting.qty, stage(["receiving", "ready"])));
T.check("units are never added together (one figure per unit)", Object.keys(p.purchase.booked).every((u) => u !== "TOTAL"));
T.check("Country-wise bills add up to the bill count", p.countries.reduce((s, x) => s + x.bills, 0) === all.length);

// drill-down + search
const first = p.countries[0];
if (first) {
  const dr = data(await bills("global_super", `&place=${encodeURIComponent(first.key)}`));
  T.check(`drill into ${first.countryName} / ${first.branchName}: only that place, panels follow it`, dr.bills.length === first.bills && dr.bills.every((b) => `${b.countryId ?? "-"}|${b.cityBranchId ?? b.countryBranchId ?? "-"}` === first.key) && dr.panels.purchase.bills === first.bills && dr.panels.countries.length === p.countries.length);
}
const pick = all.find((b) => b.entries.length > 0) ?? all[0];
if (pick) {
  const sr = data(await bills("global_super", `&search=${encodeURIComponent(pick.purchaseNo)}`));
  T.check("search by purchase no finds the whole bill (not a slice of its rows)", sr.bills.some((b) => b.sourceId === pick.sourceId && same(b.booked, pick.booked) && same(b.loaded, pick.loaded)));
  const cont = pick.entries.find((e) => e.truckOrContainer)?.truckOrContainer;
  if (cont) T.check("search by container finds its bill with full totals", data(await bills("global_super", `&search=${encodeURIComponent(cont)}`)).bills.some((b) => b.sourceId === pick.sourceId && same(b.booked, pick.booked)));
}

// RBAC: exactly the canonical journal's scope for every role
for (const who of ["pk_country_biz", "quetta_biz", "deira_biz"]) {
  const reg = data(await bills(who));
  const canon = new Set((data(await rows(who))?.rows ?? []).map((r) => r.sourceId));
  const ids = new Set((reg?.bills ?? []).map((b) => b.sourceId));
  T.check(`${who}: the register shows exactly the bills the canonical Stock Journal allows`, ids.size === canon.size && [...ids].every((x) => canon.has(x)), `${ids.size} / ${canon.size}`);
  T.check(`${who}: never more than the Super Admin`, ids.size <= all.length);
}
const q = data(await bills("quetta_biz"));
T.check("Quetta branch admin: only bills of (or destined to) its branch", (q?.bills ?? []).every((b) => b.cityBranchId === IDS.QUETTA || b.countryId === IDS.PK), `${q?.bills?.length}`);
const ship = await bills("chaman_ship");
T.check("a Shipping-only login is refused (Business purchase stock)", ship.status === 403, `${ship.status}`);
T.check("an explicit other-country filter is refused for a country admin", (await c.pk_country_biz.get(`/api/erp/inventory/journal-stock?view=bills&countryId=${IDS.UAE}`)).status === 403);

process.exit(T.summary() ? 0 : 1);
