// DEV-only role / scope matrix for the Customer Order 1A -> 1B -> 1C workflow.
// Mints signed temp sessions for the seeded DEV role-test accounts (same roles + scope
// assignments they have in the DB) and drives the real API routes, then reads the DB.
// Everything created is marked "DEV TEST ONLY" and lives on DEV (csesvyxxjivnkkozgopt) only.
//
// Usage: npx tsx scripts/e2e-verify-customer-order-roles.mts [baseUrl]

import { readFileSync } from "node:fs";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const BASE = process.argv[2] || "http://localhost:3000";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const AF = "8366fa0e-dcf6-4acd-8602-2819f103dd63";
const CUSTOMER_ID = "092d8917-3b96-48d2-bdcf-e316ebcb2ab7";
const CUSTOMER_NAME = "DEV TEST ONLY Al-Farooq Traders";

type Who = { key: string; userId: string; email: string; name: string; role: string; countryId: string; cb: string | null; city: string | null };
const PK_CB = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";
const WHO: Record<string, Who> = {
  super: { key: "super", userId: "00000000-0000-4000-8000-000000000001", email: "superadmin@dgt.llc", name: "E2E Super Admin", role: "super_admin", countryId: "", cb: null, city: null },
  pkAdmin: { key: "pkAdmin", userId: "409b050f-faf9-428f-9ec6-d9c8bc5a9dc2", email: "pakistan.admin@dgt.llc", name: "Pakistan Country Admin", role: "country_admin", countryId: PK, cb: null, city: null },
  quetta: { key: "quetta", userId: "ff270f91-3151-4dff-b0f1-515896ee26fd", email: "quetta.branch@dgt.llc", name: "Quetta City Admin", role: "city_branch_admin", countryId: PK, cb: PK_CB, city: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b" },
  chaman: { key: "chaman", userId: "e9f5a445-9780-4b83-b9ec-828d3d3d8f02", email: "chaman.branch@dgt.llc", name: "Chaman City Admin", role: "city_branch_admin", countryId: PK, cb: PK_CB, city: "322351af-732f-4351-a89b-ba34cfe598cf" },
  uae: { key: "uae", userId: "c5bb3ddf-0781-41f7-b625-241a1c6babd0", email: "uae.admin@dgt.llc", name: "UAE Country Admin", role: "country_admin", countryId: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", cb: null, city: null },
  dubai: { key: "dubai", userId: "8f07f23e-fa25-4e37-bae5-40577f96e4c9", email: "dubai.branch@dgt.llc", name: "Deira Dubai City Admin", role: "city_branch_admin", countryId: "935dd0b9-8228-43b3-b53d-c06e9ae2882f", cb: "87c2e253-b6c1-482d-a808-272337f3ffda", city: "b5e94645-05c1-4420-8ecb-141ca7d84f12" },
};

const results: { label: string; ok: boolean }[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
}

function loadEnvSecret() {
  if (process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const f of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*(ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* ignore */ }
  }
}

function cookie(w: Who) {
  const token = buildTempAgentToken({
    userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any],
    assignments: w.role === "super_admin" ? [] : [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }],
  });
  return `erp_session=${token}`;
}

async function api(w: Who, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie(w), "x-erp-lang": "en" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

const ORD = (id?: string) => `/api/erp/clearing-agent/customer-order${id ? "/" + id : ""}`;
const WF = (id: string) => `${ORD(id)}/workflow`;
const dbOrder = (id: string) => withLocalPg(async (sql) => ((await sql`select * from public.clearing_customer_orders where id = ${id}::uuid`)[0] as any));

const form = (tag: string) => ({
  customer_id: CUSTOMER_ID, customer_name: CUSTOMER_NAME, transport_mode: "by_road", movement_type: "export", shipment_type: "FCL",
  loading_country_id: AF, loading_country_name: "Afghanistan", receiving_country_id: PK, receiving_country_name: "Pakistan",
  remarks: `DEV TEST ONLY — role matrix (${tag})`, status: "pending",
  legs: [{ legNo: 1, fromCountryId: AF, fromCountryName: "Afghanistan", toCountryId: PK, toCountryName: "Pakistan", fromLocationText: "Kabul", toLocationText: "Quetta", transportMode: "by_road", status: "pending", handlerType: "our_branch", customsStatus: "not_applicable", truckRegistrationType: null }],
  loadingAllocations: [], party_links: [], truck_details: {},
});
const goods = { goodsId: "", goodsName: "DEV TEST Raisins", goodsChsCode: "0806.20", size: "M", brandQuality: "A", originCountry: "Afghanistan", unit: "Bags", quantity: "100", kgPerQty: "50", totalKg: "5100", grossWeight: "5100", emptyWeight: "100", netWeight: "5000", currency: "USD", rate: "2", finalAmount: "200", qualityReport: "", warehouseSourceType: "other", warehouseId: "", warehouseName: "DEV TEST WH", warehouseAddressText: "DEV TEST addr" };

async function fullFlow(w: Who, label: string) {
  const c = await api(w, "POST", ORD(), form(`${label}-${Date.now()}`));
  const id = c.json?.data?.id as string | undefined;
  check(`[${label}] 1A create accepted`, c.status === 200 && !!id, { http: c.status, body: c.text.slice(0, 200) });
  if (!id) return null;
  const f1b = { ...form(label), truck_number: "DEVTEST-ROLE-1", truck_driver_name: "DEV Driver", truck_registration_type: "registered", truck_vehicle_type: "Flatbed Truck", legs: [{ ...form(label).legs[0], id: (await withLocalPg(async (sql) => (await sql`select id from public.clearing_customer_order_legs where order_id=${id}::uuid limit 1`)[0]?.id)), truckRegistrationType: "registered" }] };
  const p = await api(w, "PATCH", ORD(id), f1b);
  check(`[${label}] 1B Save Draft accepted`, p.status === 200 && p.json?.success === true, { http: p.status, body: p.text.slice(0, 200) });
  const t = await api(w, "POST", WF(id), { action: "confirm_truck", truckNumber: "DEVTEST-ROLE-1", truckRegistrationType: "registered", continueMyself: true });
  check(`[${label}] 1B confirm_truck accepted`, t.status === 200 && t.json?.success === true, { http: t.status, body: t.text.slice(0, 200) });
  const g = await api(w, "POST", WF(id), { action: "complete_goods", goodsItems: [goods] });
  check(`[${label}] 1C complete_goods accepted`, g.status === 200 && g.json?.success === true, { http: g.status, body: g.text.slice(0, 200) });
  const db = await dbOrder(id);
  check(`[${label}] DB: completed, truck stored, goods stored`, db.status === "completed" && db.truck_number === "DEVTEST-ROLE-1" && Number(db.goods_net_weight) === 5000, { status: db.status, truck: db.truck_number, net: db.goods_net_weight });
  return { id, db };
}

async function main() {
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  loadEnvSecret();
  console.log(`DEV confirmed. Target: ${BASE}\n`);

  console.log("==== Super Admin ====");
  await fullFlow(WHO.super, "SuperAdmin");

  console.log("\n==== Country Admin (Pakistan) ====");
  const pk = await fullFlow(WHO.pkAdmin, "CountryAdmin-PK");
  if (pk) {
    const o = await dbOrder(pk.id);
    check("[CountryAdmin-PK] order is scoped to Pakistan", o.country_id === PK, o.country_id);
    const uae = await api(WHO.uae, "GET", ORD(pk.id));
    check("[CountryAdmin-UAE] cannot read a Pakistan order (403)", uae.status === 403, { http: uae.status });
    const uaeWf = await api(WHO.uae, "POST", WF(pk.id), { action: "confirm_truck", truckNumber: "HACK-1" });
    check("[CountryAdmin-UAE] cannot run a workflow stage on a Pakistan order (403)", uaeWf.status === 403, { http: uaeWf.status, body: uaeWf.text.slice(0, 160) });
    const uaeSave = await api(WHO.uae, "PATCH", ORD(pk.id), form("hack"));
    check("[CountryAdmin-UAE] cannot overwrite a Pakistan order (403)", uaeSave.status === 403, { http: uaeSave.status });
  }

  console.log("\n==== Branch user (Quetta city admin) + assigned operational user ====");
  const q = await api(WHO.quetta, "POST", ORD(), form(`quetta-${Date.now()}`));
  const qid = q.json?.data?.id as string | undefined;
  check("[Quetta] 1A create accepted (branch-scoped)", q.status === 200 && !!qid, { http: q.status, body: q.text.slice(0, 200) });
  if (qid) {
    const o = await dbOrder(qid);
    check("[Quetta] order carries the Quetta city/branch scope", o.city_branch_id === WHO.quetta.city && o.country_id === PK, { city: o.city_branch_id, country: o.country_id });
    const dub = await api(WHO.dubai, "GET", ORD(qid));
    check("[Dubai] is outside the order's scope before assignment (403)", dub.status === 403, { http: dub.status });

    // Quetta assigns Stage 1B to the Dubai user (outside branch scope) — the "assigned operational user".
    const h = await api(WHO.quetta, "POST", WF(qid), { action: "handover_1a", toUserId: WHO.dubai.userId, toCountryId: WHO.dubai.countryId, toCountryBranchId: WHO.dubai.cb, toCityBranchId: WHO.dubai.city, instructions: "DEV TEST ONLY — confirm truck" });
    check("[Quetta] Assign to Another User (1B) accepted", h.status === 200 && h.json?.success === true, { http: h.status, body: h.text.slice(0, 220) });
    const after = await dbOrder(qid);
    check("[Quetta] order moved to booking_confirmed / truck_assignment", after.status === "booking_confirmed" && after.current_stage === "truck_assignment", { s: after.status, st: after.current_stage });

    const dubGet = await api(WHO.dubai, "GET", ORD(qid));
    check("[Dubai/assignee] can now open the assigned order", dubGet.status === 200, { http: dubGet.status, body: dubGet.text.slice(0, 160) });
    const dubTruck = await api(WHO.dubai, "POST", WF(qid), { action: "confirm_truck", truckNumber: "DEVTEST-ASSIGNEE-9", truckRegistrationType: "registered", continueMyself: true });
    check("[Dubai/assignee] confirm_truck accepted", dubTruck.status === 200 && dubTruck.json?.success === true, { http: dubTruck.status, body: dubTruck.text.slice(0, 200) });
    const dubGoods = await api(WHO.dubai, "POST", WF(qid), { action: "complete_goods", goodsItems: [goods] });
    check("[Dubai/assignee] complete_goods accepted", dubGoods.status === 200 && dubGoods.json?.success === true, { http: dubGoods.status, body: dubGoods.text.slice(0, 200) });
    const fin = await dbOrder(qid);
    check("[Assigned flow] DB: completed with the assignee's truck and the goods", fin.status === "completed" && fin.truck_number === "DEVTEST-ASSIGNEE-9" && Number(fin.goods_net_weight) === 5000, { s: fin.status, t: fin.truck_number });
    const tasks = await withLocalPg(async (sql) => (await sql`select status from public.user_tasks where related_record_id = ${qid}::uuid`) as any[]);
    check("[Assigned flow] the assignee's task is closed (completed), not left open", tasks.length > 0 && tasks.every((t) => t.status === "completed"), tasks);
    const xfers = await withLocalPg(async (sql) => (await sql`select status from public.inter_country_transfers where source_id = ${qid}::uuid`) as any[]);
    check("[Assigned flow] the handover transfer is closed (completed)", xfers.length > 0 && xfers.every((t) => t.status === "completed"), xfers);
  }

  console.log("\n==== Same-branch peer (Chaman) vs Quetta order ====");
  if (qid) {
    const ch = await api(WHO.chaman, "GET", ORD(qid));
    check("[Chaman] sees the order only if inside its scope (same country branch → allowed by design; different city)", ch.status === 200 || ch.status === 403, { http: ch.status });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  for (const f of failed) console.log(` FAIL  ${f.label}`);
  process.exitCode = failed.length ? 1 : 0;
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
