// DEV-only HTTP + DB E2E for the Shipping & Clearing -> New Customer Order workflow
// (1A Booking -> 1B Truck/Fleet -> 1C Goods -> Review/Final). Drives the REAL API
// routes on the running dev server with a minted session cookie and then reads the
// DB directly to prove what was actually stored. Every record is clearly marked
// "DEV TEST ONLY" and is created on DEV (csesvyxxjivnkkozgopt) only.
//
// Usage:  npx tsx scripts/e2e-verify-customer-order-1abc.mts [baseUrl]

import { readFileSync } from "node:fs";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const DEV_HOST_FRAGMENT = "csesvyxxjivnkkozgopt";
const BASE = process.argv[2] || "http://localhost:3000";
const SUPERADMIN_ID = "00000000-0000-4000-8000-000000000001";
const AF = "8366fa0e-dcf6-4acd-8602-2819f103dd63"; // Afghanistan
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14"; // Pakistan
const DEV_CUSTOMER_ID = "092d8917-3b96-48d2-bdcf-e316ebcb2ab7"; // "DEV TEST ONLY Al-Farooq Traders"
const DEV_CUSTOMER_NAME = "DEV TEST ONLY Al-Farooq Traders";

const results: { label: string; ok: boolean; detail?: string }[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  results.push({ label, ok, detail: ok ? undefined : JSON.stringify(detail) });
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
    } catch { /* file may not exist */ }
  }
}

function superCookie() {
  const token = buildTempAgentToken({
    userId: SUPERADMIN_ID,
    email: "superadmin@dgt.llc",
    fullName: "E2E Super Admin",
    roles: ["super_admin"],
    assignments: [],
  });
  return `erp_session=${token}`;
}

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, "x-erp-lang": "en" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

const dbOrder = (id: string) =>
  withLocalPg(async (sql) => {
    const [o] = await sql`select * from public.clearing_customer_orders where id = ${id}::uuid`;
    const legs = await sql`select * from public.clearing_customer_order_legs where order_id = ${id}::uuid and deleted_at is null order by leg_no`;
    const allocs = await sql`select * from public.clearing_customer_order_loading_allocations where order_id = ${id}::uuid and deleted_at is null order by row_serial`;
    return { o: o as any, legs: legs as any[], allocs: allocs as any[] };
  });

// ---- payload builders: mirror handleSaveProgress() in customer-order-management-view.tsx ----
type Form = Record<string, any>;
const WF = (id: string) => `/api/erp/clearing-agent/customer-order/${id}/workflow`;
const ORD = (id?: string) => `/api/erp/clearing-agent/customer-order${id ? "/" + id : ""}`;

const baseForm = (mode: "by_road" | "by_sea" | "by_air" | "by_rail", tag: string): Form => ({
  customer_id: DEV_CUSTOMER_ID,
  customer_name: DEV_CUSTOMER_NAME,
  transport_mode: mode,
  movement_type: "export",
  shipment_type: "FCL",
  loading_country_id: AF, loading_country_name: "Afghanistan",
  receiving_country_id: PK, receiving_country_name: "Pakistan",
  loading_port_name: `DEV TEST Port ${tag}`,
  remarks: `DEV TEST ONLY — workflow 1A/1B/1C verification (${tag})`,
  status: "pending", // the browser keeps the status it loaded
  truck_id: "", truck_number: "", truck_driver_name: "", truck_driver_mobile: "",
  truck_transport_company: "", truck_details: {}, cargo_details: "",
  goods_name: null, goods_quantity: null,
  legs: [{
    legNo: 1, fromCountryId: AF, fromCountryName: "Afghanistan", toCountryId: PK, toCountryName: "Pakistan",
    fromLocationText: "Kabul", toLocationText: "Karachi", transportMode: mode, status: "pending",
    handlerType: "our_branch", customsStatus: "not_applicable",
    truckRegistrationType: null,
    insuranceRequired: true, insurance_required: true,
  }],
  loadingAllocations: [],
  party_links: [],
});

const goodsItem = (n: number) => ({
  goodsId: "", goodsName: `DEV TEST Dry Fruit ${n}`, goodsChsCode: `0802.${n}1`, goodsVariationLabel: "Grade A",
  size: "Large", brandQuality: "Premium", originCountry: "Afghanistan",
  unit: "Bags", quantity: String(100 * n), kgPerQty: "50", totalKg: String(5100 * n),
  grossWeight: String(5100 * n), emptyWeight: String(100 * n), netWeight: String(5000 * n),
  currency: "USD", rate: "2.5", finalAmount: String(12500 * n), qualityReport: "OK",
  warehouseSourceType: "other", warehouseId: "", warehouseName: `DEV TEST WH ${n}`, warehouseAddressText: `DEV TEST Address ${n}`,
});

const legsFromDb = (legs: any[], reg: string | null) => legs.map((l) => ({
  id: l.id, legNo: l.leg_no, fromCountryId: l.from_country_id, fromCountryName: l.from_country_name,
  toCountryId: l.to_country_id, toCountryName: l.to_country_name, fromLocationText: l.from_location_text,
  toLocationText: l.to_location_text, transportMode: l.transport_mode, status: l.status,
  handlerType: l.handler_type, customsStatus: l.customs_status, truckRegistrationType: reg,
  insuranceRequired: l.insurance_required, insurance_required: l.insurance_required,
}));

async function newOrder(cookie: string, mode: "by_road" | "by_sea" | "by_air" | "by_rail", tag: string) {
  const f = baseForm(mode, tag);
  const r = await api(cookie, "POST", ORD(), f);
  return { f, r, id: r.json?.data?.id as string | undefined };
}

async function main() {
  if (!getDbUrl().includes(DEV_HOST_FRAGMENT)) throw new Error("Refusing to run: DATABASE_URL does not target DEV.");
  loadEnvSecret();
  console.log(`DEV confirmed. Target server: ${BASE}\n`);
  const cookie = superCookie();

  const probe = await api(cookie, "GET", ORD());
  if (probe.status !== 200) throw new Error(`Auth probe failed: ${probe.status} ${probe.text.slice(0, 200)}`);
  console.log(`Auth OK (orders visible: ${(probe.json?.data || []).length})\n`);

  // =================== FULL FLOW, every transport mode ===================
  for (const mode of ["by_road", "by_sea", "by_air", "by_rail"] as const) {
    console.log(`\n======== FULL FLOW — ${mode} ========`);
    const tag = `${mode}-${Date.now()}`;
    const { f: f1a, r: c1, id } = await newOrder(cookie, mode, tag);
    check(`[${mode}] 1A POST create accepted`, c1.status === 200 && c1.json?.success === true, c1.text.slice(0, 300));
    if (!id) continue;
    let db = await dbOrder(id);
    check(`[${mode}] 1A stored: customer + 1 leg + stage=booking`, db.o.customer_name === DEV_CUSTOMER_NAME && db.legs.length === 1 && db.o.current_stage === "booking", { stage: db.o.current_stage, legs: db.legs.length });
    check(`[${mode}] 1A stored: leg insurance_required=true`, db.legs[0]?.insurance_required === true, db.legs[0]?.insurance_required);

    // ---- 1B : Save Draft (truck + the 1B fleet fields) ----
    const f1b = {
      ...f1a, truck_number: "DEVTEST-TRK-1234", truck_driver_name: "DEV TEST Driver", truck_driver_mobile: "+93700000000",
      truck_transport_company: "DEV TEST Transport Co", truck_registration_type: "registered",
      truck_vehicle_type: "Flatbed Truck", truck_arrival_time: "2026-10-03T08:30", truck_loading_location: "DEV TEST Yard", truck_status: "At Gate",
      truck_details: { vehicleType: "Flatbed Truck", assignmentMode: "permanent" },
      legs: legsFromDb(db.legs, "registered"),
    };
    const p1 = await api(cookie, "PATCH", ORD(id), f1b);
    check(`[${mode}] 1B Save Draft (PATCH) accepted`, p1.status === 200 && p1.json?.success === true, p1.text.slice(0, 300));
    db = await dbOrder(id);
    check(`[${mode}] 1B Save Draft stored truck number + driver`, db.o.truck_number === "DEVTEST-TRK-1234" && db.o.truck_driver_name === "DEV TEST Driver", { truck: db.o.truck_number, driver: db.o.truck_driver_name });
    check(`[${mode}] 1B Save Draft stored vehicle type / arrival / yard / status in truck_details`, typeof db.o.truck_details === "object" && db.o.truck_details?.vehicleType === "Flatbed Truck" && db.o.truck_details?.loadingLocation === "DEV TEST Yard" && db.o.truck_details?.truckStatus === "At Gate", db.o.truck_details);
    check(`[${mode}] 1B Save Draft did not complete the order or move the stage`, db.o.status === "pending" && db.o.current_stage === "booking", { status: db.o.status, stage: db.o.current_stage });

    // ---- 1B : Confirm truck ----
    const w1 = await api(cookie, "POST", WF(id), {
      action: "confirm_truck", truckNumber: "DEVTEST-TRK-1234", truckDriverName: "DEV TEST Driver", truckDriverMobile: "+93700000000",
      vehicleType: "Flatbed Truck", truckRegistrationType: "registered", truckTransportCompany: "DEV TEST Transport Co",
      arrivalTime: "2026-10-03T08:30", loadingLocation: "DEV TEST Yard", truckStatus: "At Gate", continueMyself: true,
    });
    check(`[${mode}] 1B confirm_truck returns the {success:true} envelope the browser checks`, w1.status === 200 && w1.json?.success === true && w1.json?.data?.status === "truck_confirmed", w1.text.slice(0, 300));
    db = await dbOrder(id);
    check(`[${mode}] 1B confirmed: status=truck_confirmed, stage=goods_verification`, db.o.status === "truck_confirmed" && db.o.current_stage === "goods_verification", { status: db.o.status, stage: db.o.current_stage });
    check(`[${mode}] 1B confirmed: truck_details is a real jsonb OBJECT with stage1bCompleted`, typeof db.o.truck_details === "object" && db.o.truck_details?.stage1bCompleted === true, db.o.truck_details);

    // ---- 1C : Save Draft with goods (the browser still holds status 'pending') ----
    const items = [goodsItem(1), goodsItem(2)];
    const f1c = {
      ...f1b, goods_name: items.map((g) => g.goodsName).join(", "), goods_chs_code: items[0].goodsChsCode, goods_brand: "Premium", goods_quantity: 300, goods_gross_weight: 15300, goods_net_weight: 15000,
      goods_items: items,
      loadingAllocations: items.map((g, i) => ({ rowSerial: i + 1, warehouseName: g.warehouseName, sourceLocationText: g.warehouseAddressText, quantity: Number(g.quantity), unit: g.unit, remarks: `${g.goodsName} (${g.kgPerQty} kg/${g.unit}) • Total: ${g.totalKg} kg` })),
    };
    const p2 = await api(cookie, "PATCH", ORD(id), f1c);
    check(`[${mode}] 1C Save Draft (PATCH) accepted`, p2.status === 200 && p2.json?.success === true, p2.text.slice(0, 300));
    db = await dbOrder(id);
    check(`[${mode}] 1C Save Draft keeps status truck_confirmed (no regression to pending)`, db.o.status === "truck_confirmed", { status: db.o.status });
    check(`[${mode}] 1C Save Draft keeps the 1B truck + confirmation marker`, db.o.truck_number === "DEVTEST-TRK-1234" && db.o.truck_details?.stage1bCompleted === true && db.o.truck_details?.vehicleType === "Flatbed Truck", { truck: db.o.truck_number, details: db.o.truck_details });
    check(`[${mode}] 1C Save Draft keeps leg insurance_required`, db.legs[0]?.insurance_required === true, db.legs[0]?.insurance_required);
    check(`[${mode}] 1C Save Draft stored both goods rows + the full per-item manifest`, db.allocs.length === 2 && Array.isArray(db.o.goods_items) && db.o.goods_items.length === 2 && db.o.goods_items[0].brandQuality === "Premium" && db.o.goods_items[1].rate === "2.5", { allocs: db.allocs.length, goods_items: JSON.stringify(db.o.goods_items)?.slice(0, 120) });

    // ---- 1C : Complete goods ----
    const w2 = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: items, totalItems: 2, totalNetWeight: 15000 });
    check(`[${mode}] 1C complete_goods returns {success:true}`, w2.status === 200 && w2.json?.success === true && w2.json?.data?.status === "completed", w2.text.slice(0, 300));
    db = await dbOrder(id);
    check(`[${mode}] 1C completed: status=completed, stage=completed`, db.o.status === "completed" && db.o.current_stage === "completed", { status: db.o.status, stage: db.o.current_stage });
    check(`[${mode}] 1C completed: HS code / brand / size NOT blanked`, db.o.goods_chs_code === items[0].goodsChsCode && db.o.goods_brand === "Premium" && db.o.goods_size === "Large", { chs: db.o.goods_chs_code, brand: db.o.goods_brand, size: db.o.goods_size });
    check(`[${mode}] 1C completed: totals (qty 300, gross 15300, net 15000)`, Number(db.o.goods_quantity) === 300 && Number(db.o.goods_gross_weight) === 15300 && Number(db.o.goods_net_weight) === 15000, { q: db.o.goods_quantity, g: db.o.goods_gross_weight, n: db.o.goods_net_weight });
    check(`[${mode}] 1C completed: cargo_details free-text NOT overwritten with JSON`, !String(db.o.cargo_details ?? "").trim().startsWith("["), db.o.cargo_details);
    check(`[${mode}] 1C completed: manifest + allocations + verification row stored`, Array.isArray(db.o.goods_items) && db.o.goods_items.length === 2 && db.allocs.length === 2, { items: db.o.goods_items?.length, allocs: db.allocs.length });

    // ---- Final submit (Review): the browser sends status 'booking_confirmed' ----
    const fFinal = { ...f1c, status: "booking_confirmed" };
    const pf = await api(cookie, "PATCH", ORD(id), fFinal);
    db = await dbOrder(id);
    check(`[${mode}] FINAL SUBMIT keeps the order completed`, pf.status === 200 && db.o.status === "completed" && db.o.truck_number === "DEVTEST-TRK-1234", { http: pf.status, status: db.o.status, truck: db.o.truck_number });

    // ---- A stale 1A/1B form (opened before goods existed) saving later must not wipe 1C ----
    const staleSave = await api(cookie, "PATCH", ORD(id), { ...f1a, status: "pending", goods_items: [], loadingAllocations: [], goods_name: null, goods_quantity: null, goods_gross_weight: null, goods_net_weight: null });
    db = await dbOrder(id);
    check(`[${mode}] STALE FORM: an old 1A form saving after completion keeps goods, manifest, allocations, truck and status`, staleSave.status === 200 && db.o.status === "completed" && Number(db.o.goods_net_weight) === 15000 && Array.isArray(db.o.goods_items) && db.o.goods_items.length === 2 && db.allocs.length === 2 && db.o.truck_number === "DEVTEST-TRK-1234", { http: staleSave.status, status: db.o.status, net: db.o.goods_net_weight, items: db.o.goods_items?.length, allocs: db.allocs.length, truck: db.o.truck_number });

    // ---- Reopen ----
    const g = await api(cookie, "GET", ORD(id));
    const re = g.json?.data;
    check(`[${mode}] REOPEN: customer, route, truck, goods, totals, manifest all present`, re?.customer_name === DEV_CUSTOMER_NAME && re?.truck_number === "DEVTEST-TRK-1234" && Number(re?.goods_net_weight) === 15000 && (re?.legs || []).length === 1 && Array.isArray(re?.goods_items) && re.goods_items.length === 2, { customer: re?.customer_name, truck: re?.truck_number, net: re?.goods_net_weight });
    check(`[${mode}] REOPEN: leg insurance_required still true`, re?.legs?.[0]?.insurance_required === true, re?.legs?.[0]?.insurance_required);

    // ---- Activity timeline now carries real, parsed stage data ----
    const tl = await api(cookie, "GET", WF(id));
    const timeline: any[] = tl.json?.data?.timeline || [];
    check(`[${mode}] TIMELINE: GET envelope {success:true,data.timeline} and 1B + 1C entries present`, tl.json?.success === true && timeline.some((t) => t.stage === "1B" && /DEVTEST-TRK-1234/.test(t.action)) && timeline.some((t) => t.stage === "1C"), timeline.map((t) => `${t.stage}:${t.action}`));
  }

  // =================== COMPLETION GATES ===================
  console.log("\n======== COMPLETION GATES ========");
  {
    const { r, id } = await newOrder(cookie, "by_road", `gateA-${Date.now()}`);
    check("[gate] fresh 1A-only order created", !!id, r.text.slice(0, 200));
    if (id) {
      const a = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: [goodsItem(1)] });
      let db = await dbOrder(id);
      check("[gate] complete_goods REJECTED (409, STAGE_1B_INCOMPLETE) while 1B is unconfirmed — order untouched", a.status === 409 && a.json?.success === false && a.json?.code === "STAGE_1B_INCOMPLETE" && typeof a.json?.error === "string" && db.o.status === "pending", { http: a.status, body: a.text.slice(0, 200), status: db.o.status });
      const b = await api(cookie, "POST", WF(id), { action: "confirm_truck", truckNumber: "   " });
      check("[gate] confirm_truck with a blank truck number rejected (400) with a readable message", b.status === 400 && b.json?.success === false && /Truck Number is required/i.test(b.json?.error ?? ""), { http: b.status, body: b.text.slice(0, 200) });
      const c = await api(cookie, "POST", WF(id), { action: "confirm_truck", truckNumber: "DEVTEST-GATE-1", truckRegistrationType: "registered", continueMyself: true });
      check("[gate] confirm_truck with a real truck accepted", c.status === 200 && c.json?.success === true, c.text.slice(0, 200));
      const d = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: [{ ...goodsItem(1), goodsName: "", quantity: "" }] });
      db = await dbOrder(id);
      check("[gate] complete_goods with an empty goods row REJECTED (422, STAGE_1C_INCOMPLETE) — still truck_confirmed", d.status === 422 && d.json?.code === "STAGE_1C_INCOMPLETE" && db.o.status === "truck_confirmed", { http: d.status, body: d.text.slice(0, 240), status: db.o.status });
      const e = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: [{ ...goodsItem(1), grossWeight: "0", totalKg: "0" }] });
      check("[gate] complete_goods with zero weight REJECTED (422)", e.status === 422 && e.json?.code === "STAGE_1C_INCOMPLETE", { http: e.status, body: e.text.slice(0, 200) });
      const ok = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: [goodsItem(1)] });
      check("[gate] complete_goods with valid goods then SUCCEEDS", ok.status === 200 && ok.json?.success === true, ok.text.slice(0, 200));
      const again = await api(cookie, "POST", WF(id), { action: "confirm_truck", truckNumber: "DEVTEST-OTHER" });
      check("[gate] confirm_truck on an already COMPLETED order is refused (409)", again.status === 409, { http: again.status, body: again.text.slice(0, 160) });
    }
  }
  {
    const { id } = await newOrder(cookie, "by_road", `gateB-${Date.now()}`);
    if (id) {
      const later = await api(cookie, "POST", WF(id), { action: "confirm_truck", truckNumber: "TO BE ASSIGNED", truckRegistrationType: null, continueMyself: true });
      const g = await api(cookie, "POST", WF(id), { action: "complete_goods", goodsItems: [goodsItem(1)] });
      const db = await dbOrder(id);
      check("[gate] 'Assign Later' placeholder truck is accepted at 1B but BLOCKS completion (409) until a real truck is set", later.status === 200 && g.status === 409 && g.json?.code === "STAGE_1B_INCOMPLETE" && db.o.status === "truck_confirmed", { later: later.status, complete: g.status, body: g.text.slice(0, 220), status: db.o.status });
    }
  }

  // =================== CROSS-BORDER TRUCK RULE ===================
  console.log("\n======== CROSS-BORDER ROAD RULE ========");
  {
    const { f, id } = await newOrder(cookie, "by_road", `xb-${Date.now()}`);
    if (id) {
      const db = await dbOrder(id);
      const hired = await api(cookie, "PATCH", ORD(id), { ...f, truck_number: "DEVTEST-HIRED-1", truck_registration_type: "temporary", legs: legsFromDb(db.legs, "temporary") });
      check("[xborder] hired/temporary truck on a cross-border road leg -> clean 422 CROSS_BORDER_TRUCK_RULE (not a raw SQL 500)", hired.status === 422 && hired.json?.code === "CROSS_BORDER_TRUCK_RULE" && /registered truck/i.test(hired.json?.error ?? ""), { http: hired.status, body: hired.text.slice(0, 240) });
      const later = await api(cookie, "PATCH", ORD(id), { ...f, truck_number: "TO BE ASSIGNED", truck_registration_type: "registered", legs: legsFromDb(db.legs, null) });
      check("[xborder] 'Assign Later' (no registration type) on the same leg is ACCEPTED", later.status === 200 && later.json?.success === true, { http: later.status, body: later.text.slice(0, 200) });
    }
  }

  // =================== STATUS CANNOT BE FORGED THROUGH A DRAFT SAVE ===================
  console.log("\n======== STATUS FORGERY GUARD ========");
  {
    const f = { ...baseForm("by_road", `forge-${Date.now()}`), status: "completed" };
    const r = await api(cookie, "POST", ORD(), f);
    const id = r.json?.data?.id as string | undefined;
    if (id) {
      let db = await dbOrder(id);
      check("[forge] creating an order with status 'completed' is stored as 'pending'", db.o.status === "pending", db.o.status);
      const p = await api(cookie, "PATCH", ORD(id), { ...f, status: "truck_confirmed" });
      db = await dbOrder(id);
      check("[forge] a draft save claiming 'truck_confirmed' does NOT confirm the truck", p.status === 200 && db.o.status === "pending", db.o.status);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ====`);
  for (const f of failed) console.log(` FAIL  ${f.label}`);
  process.exitCode = failed.length ? 1 : 0;
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
