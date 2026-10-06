// DEV-only HTTP + DB E2E for the Customer Order repairs: temporary/one-trip truck validation,
// road-leg-only truck binding, multi-modal journeys (import scenarios, re-export, external partners),
// schema columns, the full multi-user assign -> accept -> confirm -> assign -> accept -> complete chain,
// Return for Correction, and the simplified 1C goods weights. Every record is "DEV TEST ONLY".
//
// Usage:  npx tsx scripts/e2e-verify-customer-order-v2.mts [baseUrl]

import { readFileSync } from "node:fs";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const BASE = process.argv[2] || "http://localhost:3000";
const AF = "8366fa0e-dcf6-4acd-8602-2819f103dd63";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const AE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const IR = ""; // resolved from DB
const CUSTOMER_ID = "092d8917-3b96-48d2-bdcf-e316ebcb2ab7";
const CUSTOMER_NAME = "DEV TEST ONLY Al-Farooq Traders";
const PK_CB = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";

type Who = { userId: string; email: string; name: string; role: string; countryId: string; cb: string | null; city: string | null };
const SUPER: Who = { userId: "00000000-0000-4000-8000-000000000001", email: "superadmin@dgt.llc", name: "E2E Super Admin", role: "super_admin", countryId: "", cb: null, city: null };
const CHAMAN: Who = { userId: "e9f5a445-9780-4b83-b9ec-828d3d3d8f02", email: "chaman.branch@dgt.llc", name: "Chaman City Admin", role: "city_branch_admin", countryId: PK, cb: PK_CB, city: "322351af-732f-4351-a89b-ba34cfe598cf" };
const DUBAI: Who = { userId: "8f07f23e-fa25-4e37-bae5-40577f96e4c9", email: "dubai.branch@dgt.llc", name: "Deira Dubai City Admin", role: "city_branch_admin", countryId: AE, cb: "87c2e253-b6c1-482d-a808-272337f3ffda", city: "b5e94645-05c1-4420-8ecb-141ca7d84f12" };
const UAE_ADMIN: Who = { userId: "c5bb3ddf-0781-41f7-b625-241a1c6babd0", email: "uae.admin@dgt.llc", name: "UAE Country Admin", role: "country_admin", countryId: AE, cb: null, city: null };

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
const cookie = (w: Who) =>
  `erp_session=${buildTempAgentToken({
    userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any],
    assignments: w.role === "super_admin" ? [] : [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }],
  })}`;
async function api(w: Who, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie(w), "x-erp-lang": "en" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(240000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}
const ORD = (id?: string) => `/api/erp/clearing-agent/customer-order${id ? "/" + id : ""}`;
const WF = (id: string) => `${ORD(id)}/workflow`;
const dbOrder = (id: string) =>
  withLocalPg(async (sql) => ({
    o: (await sql`select * from public.clearing_customer_orders where id=${id}::uuid`)[0] as any,
    legs: (await sql`select * from public.clearing_customer_order_legs where order_id=${id}::uuid and deleted_at is null order by leg_no`) as any[],
  }))!;

const leg = (n: number, mode: string, from: [string, string, string], to: [string, string, string], extra: Record<string, any> = {}) => ({
  legNo: n, transportMode: mode,
  fromCountryId: from[0], fromCountryName: from[1], fromLocationText: from[2],
  toCountryId: to[0], toCountryName: to[1], toLocationText: to[2],
  status: "pending", handlerType: "our_branch", customsStatus: "not_applicable", truckRegistrationType: null, ...extra,
});
const form = (tag: string, movement: string, legs: any[], extra: Record<string, any> = {}) => ({
  customer_id: CUSTOMER_ID, customer_name: CUSTOMER_NAME, transport_mode: legs[0]?.transportMode ?? "by_road", movement_type: movement, shipment_type: "FCL",
  loading_country_id: legs[0]?.fromCountryId ?? AE, loading_country_name: legs[0]?.fromCountryName ?? "United Arab Emirates",
  receiving_country_id: legs[legs.length - 1]?.toCountryId ?? AF, receiving_country_name: legs[legs.length - 1]?.toCountryName ?? "Afghanistan",
  remarks: `DEV TEST ONLY — v2 verification (${tag})`, status: "pending",
  legs, loadingAllocations: [], party_links: [], truck_details: {}, ...extra,
});
const legsFromDb = (legs: any[], patch: (l: any, i: number) => Record<string, any>) =>
  legs.map((l, i) => ({
    id: l.id, legNo: l.leg_no, fromCountryId: l.from_country_id, fromCountryName: l.from_country_name, toCountryId: l.to_country_id,
    toCountryName: l.to_country_name, fromLocationText: l.from_location_text, toLocationText: l.to_location_text, transportMode: l.transport_mode,
    status: l.status, handlerType: l.handler_type, partnerType: l.partner_type, partnerName: l.partner_name, partnerAccountId: l.partner_account_id,
    partnerAccountNumber: l.partner_account_number, partnerCountryName: l.partner_country_name, customsStatus: l.customs_status,
    clearanceType: l.clearance_type, truckRegistrationType: null, ...patch(l, i),
  }));

async function main() {
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  loadEnvSecret();
  console.log(`DEV confirmed. Target: ${BASE}\n`);

  // ───────── schema ─────────
  console.log("==== Schema on the environment serving this app ====");
  const cols = await withLocalPg(async (sql) => (await sql`
    select column_name from information_schema.columns where table_schema='public' and
      ((table_name='clearing_customer_order_legs' and column_name in ('handler_type','partner_type','partner_name','partner_account_id','partner_account_number','partner_country_name','insurance_required'))
       or (table_name='clearing_customer_orders' and column_name in ('goods_items','import_scenario')))`) as any[]);
  check("handler_type / partner_* / insurance_required / goods_items / import_scenario columns all exist", (cols?.length ?? 0) === 9, cols?.map((c: any) => c.column_name));
  const ledger = (await withLocalPg(async (sql) => (await sql`select id, code from public.ledgers where deleted_at is null order by created_at limit 1`) as any[]))?.[0];
  const irId = (await withLocalPg(async (sql) => (await sql`select id from public.countries where name ilike 'Iran%' limit 1`) as any[]))?.[0]?.id;

  // ───────── scenario 1: Arrival by Sea at Karachi -> Road to Chaman -> Road delivery in Afghanistan ─────────
  console.log("\n==== Import: arrived at Karachi by Sea -> Road to Chaman -> Road in Afghanistan ====");
  const s1Legs = [
    leg(1, "by_sea", [AE, "United Arab Emirates", "Jebel Ali"], [PK, "Pakistan", "Karachi Port"]),
    leg(2, "by_road", [PK, "Pakistan", "Karachi Port"], [PK, "Pakistan", "Chaman Border"], { handlerType: "external_partner", partnerType: "transporter", partnerName: "DEV TEST Partner Transporter", partnerAccountId: ledger?.id ?? null, partnerAccountNumber: ledger?.code ?? null, partnerCountryName: "Pakistan" }),
    leg(3, "by_road", [PK, "Pakistan", "Chaman Border"], [AF, "Afghanistan", "Kandahar Warehouse"]),
  ];
  const s1 = await api(SUPER, "POST", ORD(), form("scn1", "import", s1Legs, { import_scenario: "arrived_at_entry" }));
  const s1Id = s1.json?.data?.id as string;
  check("scenario 1 created (3 legs: Sea, Road, Road)", s1.status === 200 && !!s1Id, s1.text.slice(0, 300));
  if (s1Id) {
    const d = await dbOrder(s1Id);
    check("scenario 1: import_scenario stored as arrived_at_entry", d.o.import_scenario === "arrived_at_entry" && d.o.movement_type === "import", { sc: d.o.import_scenario, mv: d.o.movement_type });
    check("scenario 1: modes kept per leg (sea/road/road), transport mode separate from customs operation", d.legs.map((l) => l.transport_mode).join(",") === "by_sea,by_road,by_road", d.legs.map((l) => l.transport_mode));
    const partnerLeg = d.legs[1];
    check("scenario 1: external partner + existing ledger account linked on the road leg", partnerLeg.handler_type === "external_partner" && partnerLeg.partner_account_id === (ledger?.id ?? null) && partnerLeg.partner_name === "DEV TEST Partner Transporter", partnerLeg);

    // temporary truck validation (API)
    const withTruck = (patch: Record<string, any>) => legsFromDb(d.legs, (l, i) => (i === 1 ? { truckRegistrationType: "temporary", ...patch } : {}));
    const bad1 = await api(SUPER, "PATCH", ORD(s1Id), { ...form("scn1", "import", []), legs: withTruck({ truckNumber: "DEVTEST-TMP-1", truckDriverName: "", truckDriverMobile: "" }), truck_registration_type: "temporary", import_scenario: "arrived_at_entry" });
    check("temporary truck with only a number is REJECTED (422 TEMP_TRUCK_INCOMPLETE)", bad1.status === 422 && bad1.json?.code === "TEMP_TRUCK_INCOMPLETE", { http: bad1.status, body: bad1.text.slice(0, 200) });
    const bad2 = await api(SUPER, "PATCH", ORD(s1Id), { ...form("scn1", "import", []), legs: withTruck({ truckNumber: "DEVTEST-TMP-1", truckDriverName: "Ali Khan", truckDriverMobile: "abc123" }), truck_registration_type: "temporary", import_scenario: "arrived_at_entry" });
    check("temporary truck with an invalid mobile is REJECTED (422)", bad2.status === 422 && Array.isArray(bad2.json?.fields) && bad2.json.fields.includes("driver_mobile_invalid"), { http: bad2.status, body: bad2.text.slice(0, 200) });
    const bad3 = await api(SUPER, "PATCH", ORD(s1Id), { ...form("scn1", "import", []), legs: withTruck({ truckNumber: "", truckDriverName: "Ali Khan", truckDriverMobile: "+93 70 123 4567" }), truck_registration_type: "temporary", truck_number: "", truck_driver_name: "Ali Khan", truck_driver_mobile: "+93 70 123 4567", import_scenario: "arrived_at_entry" });
    // no truck number but driver given => partial => rejected
    check("temporary truck missing the truck number is REJECTED (422)", bad3.status === 422 && bad3.json?.fields?.includes("truck_number"), { http: bad3.status, body: bad3.text.slice(0, 200) });

    const ok = await api(SUPER, "PATCH", ORD(s1Id), {
      ...form("scn1", "import", []), legs: legsFromDb(d.legs, (l, i) => (i === 1 ? { truckRegistrationType: "temporary", truckNumber: "DEVTEST-TMP-77", truckDriverName: "Ali Khan", truckDriverMobile: "+93 70 123 4567" } : {})),
      truck_registration_type: "temporary", truck_number: "DEVTEST-TMP-77", truck_driver_name: "Ali Khan", truck_driver_mobile: "+93 70 123 4567", import_scenario: "arrived_at_entry",
    });
    check("temporary truck with number + driver + international mobile is ACCEPTED", ok.status === 200 && ok.json?.success === true, { http: ok.status, body: ok.text.slice(0, 250) });
    const d2 = await dbOrder(s1Id);
    check("truck stored on the selected local ROAD leg (2) only — the sea leg and the cross-border road leg have none", d2.legs[1].truck_number === "DEVTEST-TMP-77" && d2.legs[1].truck_driver_mobile === "+93 70 123 4567" && !d2.legs[0].truck_number && !d2.legs[2].truck_number, d2.legs.map((l) => [l.leg_no, l.transport_mode, l.truck_number]));
    check("temporary truck is NOT registered in the Fleet Master (no truck_id)", !d2.legs[1].truck_id && !d2.o.truck_id, { leg: d2.legs[1].truck_id, order: d2.o.truck_id });
    check("partner link survived the truck save", d2.legs[1].partner_account_id === (ledger?.id ?? null), d2.legs[1].partner_account_id);
    // force a truck onto a sea leg -> API strips it
    const forced = await api(SUPER, "PATCH", ORD(s1Id), { ...form("scn1", "import", []), legs: legsFromDb(d2.legs, (l, i) => ({ truckRegistrationType: "registered", truckNumber: "DEVTEST-FORCED", truckDriverName: "X", truckDriverMobile: "+92 300 0000000" })), import_scenario: "arrived_at_entry" });
    const d3 = await dbOrder(s1Id);
    check("API strips a truck sent for a Sea leg (road legs keep theirs)", forced.status === 200 && !d3.legs[0].truck_number, d3.legs.map((l) => [l.leg_no, l.transport_mode, l.truck_number]));
  }

  // ───────── scenario 2: Afghanistan -> Road to Karachi -> Sea to Dubai -> Road to final warehouse ─────────
  console.log("\n==== Export: Afghanistan -> Road Karachi -> Sea Dubai -> Road final warehouse ====");
  const s2 = await api(SUPER, "POST", ORD(), form("scn2", "export", [
    leg(1, "by_road", [AF, "Afghanistan", "Kabul"], [PK, "Pakistan", "Karachi"]),
    leg(2, "by_sea", [PK, "Pakistan", "Karachi Port"], [AE, "United Arab Emirates", "Jebel Ali"]),
    leg(3, "by_road", [AE, "United Arab Emirates", "Jebel Ali"], [AE, "United Arab Emirates", "DEV TEST Final Warehouse"]),
  ]));
  const s2Id = s2.json?.data?.id as string;
  check("scenario 2 created (Road, Sea, Road)", s2.status === 200 && !!s2Id, s2.text.slice(0, 250));
  if (s2Id) {
    const d = await dbOrder(s2Id);
    check("scenario 2: legs saved in order with correct modes and countries", d.legs.map((l) => `${l.transport_mode}:${l.from_country_name}>${l.to_country_name}`).join("|") === "by_road:Afghanistan>Pakistan|by_sea:Pakistan>United Arab Emirates|by_road:United Arab Emirates>United Arab Emirates", d.legs.map((l) => `${l.transport_mode}:${l.from_country_name}>${l.to_country_name}`));
  }

  // ───────── scenario 3: Road to Bandar Abbas -> Sea to Dubai (re-export) ─────────
  console.log("\n==== Re-export: Road to Bandar Abbas -> Sea to Dubai ====");
  const s3 = await api(SUPER, "POST", ORD(), form("scn3", "re_export", [
    leg(1, "by_road", [AF, "Afghanistan", "Herat"], [irId || PK, "Iran", "Bandar Abbas"], { clearanceType: "re_export" }),
    leg(2, "by_sea", [irId || PK, "Iran", "Bandar Abbas Port"], [AE, "United Arab Emirates", "Dubai Port"], { clearanceType: "re_export" }),
  ]));
  const s3Id = s3.json?.data?.id as string;
  check("scenario 3 (re-export) created", s3.status === 200 && !!s3Id, s3.text.slice(0, 250));
  if (s3Id) {
    const d = await dbOrder(s3Id);
    check("re-export stored as the customs operation on order and legs; import_scenario stays null", d.o.movement_type === "re_export" && d.legs.every((l) => l.clearance_type === "re_export") && d.o.import_scenario === null, { mv: d.o.movement_type, legs: d.legs.map((l) => l.clearance_type), sc: d.o.import_scenario });
  }

  // ───────── multi-user chain ─────────
  console.log("\n==== Chain: Chaman 1A -> assign Dubai (1B) -> Dubai accepts -> confirm + assign UAE admin (1C) -> accepts -> completes ====");
  const c = await api(CHAMAN, "POST", ORD(), form("chain", "export", [leg(1, "by_road", [AF, "Afghanistan", "Kabul"], [PK, "Pakistan", "Chaman"])]));
  const cId = c.json?.data?.id as string;
  check("[chain] Chaman creates 1A", c.status === 200 && !!cId, c.text.slice(0, 200));
  if (cId) {
    const h = await api(CHAMAN, "POST", WF(cId), { action: "handover_1a", toUserId: DUBAI.userId, toCountryId: DUBAI.countryId, toCountryBranchId: DUBAI.cb, toCityBranchId: DUBAI.city, instructions: "DEV TEST ONLY — confirm truck" });
    check("[chain] 1A assigned to the Truck/Transport user", h.status === 200 && h.json?.success === true, h.text.slice(0, 200));
    const view = await api(DUBAI, "GET", ORD(cId));
    const lh = view.json?.data?.latest_handover;
    check("[chain] receiver sees same order no, assigner, time and pending status", view.status === 200 && lh?.status === "pending" && lh?.sender_name && lh?.created_at && view.json?.data?.order_no, { http: view.status, lh });
  }
  const c2 = await api(CHAMAN, "POST", ORD(), form("chain2", "export", [leg(1, "by_road", [AF, "Afghanistan", "Kabul"], [PK, "Pakistan", "Chaman"])]));
  const c2Id = c2.json?.data?.id as string;
  if (c2Id) {
    await api(CHAMAN, "POST", WF(c2Id), { action: "handover_1a", toUserId: DUBAI.userId, toCountryId: DUBAI.countryId, toCountryBranchId: DUBAI.cb, toCityBranchId: DUBAI.city, instructions: "DEV TEST ONLY" });
    const stranger = await api(UAE_ADMIN, "POST", WF(c2Id), { action: "accept_stage" });
    check("[chain] a user the stage is NOT assigned to cannot accept it (403)", stranger.status === 403, { http: stranger.status, body: stranger.text.slice(0, 160) });
    const acc = await api(DUBAI, "POST", WF(c2Id), { action: "accept_stage" });
    check("[chain] assigned user accepts 1B", acc.status === 200 && acc.json?.success === true && acc.json?.data?.stage === "1B", { http: acc.status, body: acc.text.slice(0, 200) });
    const st = await withLocalPg(async (sql) => ({
      tr: (await sql`select status, accepted_at, accepted_by from public.inter_country_transfers where source_id=${c2Id}::uuid and transfer_type='truck_task' order by created_at desc limit 1`)[0] as any,
      tk: (await sql`select status, accepted_at from public.user_tasks where related_record_id=${c2Id}::uuid order by created_at desc limit 1`)[0] as any,
    }));
    check("[chain] DB: transfer accepted (by Dubai) and user task accepted", st?.tr?.status === "accepted" && st.tr.accepted_by === DUBAI.userId && st.tk?.status === "accepted", st);
    const again = await api(DUBAI, "POST", WF(c2Id), { action: "accept_stage" });
    check("[chain] accepting twice is harmless (idempotent)", again.status === 200 && again.json?.data?.alreadyAccepted === true, again.text.slice(0, 160));

    const noMobile = await api(DUBAI, "POST", WF(c2Id), { action: "confirm_truck", truckNumber: "DEVTEST-CH-2", truckRegistrationType: "temporary", truckDriverName: "Drv Only", continueMyself: true });
    check("[chain] confirm_truck for a temporary truck without a mobile is REJECTED (422)", noMobile.status === 422 && noMobile.json?.code === "TEMP_TRUCK_INCOMPLETE", { http: noMobile.status, body: noMobile.text.slice(0, 200) });
    const afterBad = await dbOrder(c2Id);
    check("[chain] failed confirm did NOT advance the workflow", afterBad.o.status !== "truck_confirmed" && afterBad.o.status !== "completed", afterBad.o.status);

    const assign = await api(DUBAI, "POST", WF(c2Id), { action: "confirm_truck", truckNumber: "DEVTEST-CH-2", truckRegistrationType: "temporary", truckDriverName: "Drv Two", truckDriverMobile: "+971 50 123 4567", goodsAssignee: { userId: UAE_ADMIN.userId, countryId: UAE_ADMIN.countryId, countryBranchId: UAE_ADMIN.cb, cityBranchId: UAE_ADMIN.city, instructions: "DEV TEST ONLY — goods" }, continueMyself: false });
    check("[chain] Dubai confirms 1B and assigns 1C to the Goods user", assign.status === 200 && assign.json?.success === true, { http: assign.status, body: assign.text.slice(0, 250) });
    const goodsView = await api(UAE_ADMIN, "GET", ORD(c2Id));
    check("[chain] Goods user sees the order, truck confirmed, pending 1C assignment", goodsView.status === 200 && goodsView.json?.data?.latest_handover?.transfer_type === "goods_verification" && goodsView.json?.data?.latest_handover?.status === "pending" && goodsView.json?.data?.truck_number === "DEVTEST-CH-2", { http: goodsView.status, lh: goodsView.json?.data?.latest_handover });
    const accC = await api(UAE_ADMIN, "POST", WF(c2Id), { action: "accept_stage" });
    check("[chain] Goods user accepts 1C", accC.status === 200 && accC.json?.data?.stage === "1C", accC.text.slice(0, 200));
    const goods = [{ goodsId: "", goodsName: "DEV TEST Rice", goodsChsCode: "1006.30", goodsVariationLabel: "Sella", lotName: "LOT-DEV-1", size: "5mm", brandQuality: "Grade A", originCountry: "Afghanistan", unit: "Bags", quantity: "200", kgPerQty: "50", totalKg: "10200", grossWeight: "10200", emptyKgPerUnit: "0.5", emptyWeight: "100", netWeight: "10100", qualityRef: "QC-1", warehouseSourceType: "other", warehouseId: "", warehouseName: "DEV TEST WH", warehouseAddressText: "addr" }];
    const done = await api(UAE_ADMIN, "POST", WF(c2Id), { action: "complete_goods", goodsItems: goods });
    check("[chain] Goods user completes 1C", done.status === 200 && done.json?.success === true, { http: done.status, body: done.text.slice(0, 250) });
    const fin = await withLocalPg(async (sql) => ({
      o: (await sql`select status, current_stage, goods_gross_weight g, goods_empty_weight e, goods_net_weight n, goods_variation_label v, goods_items from public.clearing_customer_orders where id=${c2Id}::uuid`)[0] as any,
      tr: (await sql`select transfer_type, status from public.inter_country_transfers where source_id=${c2Id}::uuid order by created_at`) as any[],
      tk: (await sql`select status from public.user_tasks where related_record_id=${c2Id}::uuid`) as any[],
    }));
    check("[chain] DB: order completed; every transfer and task closed", fin?.o?.status === "completed" && fin.tr.every((t: any) => t.status === "completed") && fin.tk.every((t: any) => t.status === "completed"), fin);
    const items = Array.isArray(fin?.o?.goods_items) ? fin.o.goods_items : JSON.parse(fin?.o?.goods_items ?? "[]");
    check("[goods] net = gross − TOTAL tare (10200 − 100 = 10100), lot/variety/quality ref kept, no price on the row", Number(fin?.o?.n) === 10100 && Number(fin?.o?.e) === 100 && items[0]?.lotName === "LOT-DEV-1" && fin?.o?.v === "Sella" && items[0]?.qualityRef === "QC-1" && items[0]?.rate === undefined && items[0]?.finalAmount === undefined, { n: fin?.o?.n, e: fin?.o?.e, item: items[0] });
    const rejectTare = await api(UAE_ADMIN, "POST", WF(c2Id), { action: "complete_goods", goodsItems: [{ ...goods[0], emptyWeight: "99999" }] });
    check("[goods] tare larger than gross is rejected", rejectTare.status === 409 || rejectTare.status === 422, rejectTare.status);
  }

  // ───────── return for correction ─────────
  console.log("\n==== Return for Correction ====");
  const r = await api(CHAMAN, "POST", ORD(), form("return", "export", [leg(1, "by_road", [AF, "Afghanistan", "Kabul"], [PK, "Pakistan", "Chaman"])]));
  const rId = r.json?.data?.id as string;
  if (rId) {
    await api(CHAMAN, "POST", WF(rId), { action: "handover_1a", toUserId: DUBAI.userId, toCountryId: DUBAI.countryId, toCountryBranchId: DUBAI.cb, toCityBranchId: DUBAI.city, instructions: "DEV TEST ONLY" });
    const noReason = await api(DUBAI, "POST", WF(rId), { action: "return_for_correction", reason: "  ", returnToStage: "1A" });
    check("[return] a reason is mandatory", noReason.status === 400, noReason.status);
    const ret = await api(DUBAI, "POST", WF(rId), { action: "return_for_correction", reason: "DEV TEST: wrong consignee", returnToStage: "1A" });
    const dr = await withLocalPg(async (sql) => ({
      o: (await sql`select status, current_stage, rejected_reason from public.clearing_customer_orders where id=${rId}::uuid`)[0] as any,
      tr: (await sql`select status, return_reason from public.inter_country_transfers where source_id=${rId}::uuid and transfer_type='truck_task' order by created_at desc limit 1`)[0] as any,
    }));
    check("[return] order returned for correction with the reason; transfer marked returned", ret.status === 200 && dr?.o?.status === "returned_for_correction" && dr.tr?.status === "returned" && /wrong consignee/.test(dr.tr?.return_reason ?? ""), { http: ret.status, dr });
    const cantComplete = await api(CHAMAN, "POST", WF(rId), { action: "complete_goods", goodsItems: [{ goodsName: "x", quantity: "1", grossWeight: "10" }] });
    check("[return] a returned order cannot be completed", cantComplete.status >= 400, cantComplete.status);
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  for (const f of failed) console.log(` FAIL  ${f.label}`);
  process.exitCode = failed.length ? 1 : 0;
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
