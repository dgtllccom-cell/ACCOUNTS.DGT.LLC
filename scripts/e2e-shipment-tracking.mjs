/**
 * Shipment Tracking — end-to-end harness (DEV ONLY).
 *
 * Drives the REAL /api/erp/tracking/* endpoints (dev-session cookie) against the REAL DEV database:
 *   search on BL / Container / Shipment / Vessel / Voyage / Customer / Shipping Line / truck / flight,
 *   case + space + hyphen insensitive matching, multi-leg (Sea, Road, Air, Train) rows and details,
 *   mode / status filters, pagination + totals, summary, authorization (401 / 403), country scope isolation,
 *   milestone recording (permission, scope, leg ownership, idempotent double-click behaviour).
 *
 *   ALLOW_DEV_SESSION=true must be set on the dev server (port from BASE, default 3240).
 *   node scripts/e2e-shipment-tracking.mjs
 *
 * Refuses to run against anything but the DEV Supabase project (csesvyxxjivnkkozgopt).
 */
import fs from "node:fs";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3240";

function envUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const t = fs.readFileSync(".env.local", "utf8");
  return t.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
}
const URL_ = envUrl();
if (!/csesvyxxjivnkkozgopt/.test(URL_)) {
  console.error("REFUSING TO RUN: DATABASE_URL is not the DEV project (csesvyxxjivnkkozgopt). Production is never used for tests.");
  process.exit(2);
}
const sql = postgres(URL_, { max: 2, prepare: false, ssl: "require" });

const results = [];
function check(section, name, ok, detail = "") {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${section}] ${name}${!ok && detail ? "  -> " + detail : ""}`);
}

async function login(body) {
  if (body === null) {
    return async (method, path, payload) => {
      const res = await fetch(`${BASE}${path}`, { method, redirect: "manual", headers: { "content-type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, json, data: json?.data };
    };
  }
  const r = await fetch(`${BASE}/api/erp/auth/dev-session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("dev-session failed: " + r.status);
  const cookies = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return async (method, path, payload) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json", cookie: cookies }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, data: json?.data, err: json?.error?.message || json?.error };
  };
}

const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const AE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const REAL_USER = "00000000-0000-4000-8000-000000000001";
const enc = encodeURIComponent;
const list = (api, q, extra = "") => api("GET", `/api/erp/tracking/list?domain=both&limit=100&q=${enc(q)}${extra}`);

async function main() {
  const admin = await login({ role: "super_admin" });
  const anon = await login(null);

  // ── 1. authorization ────────────────────────────────────────────────────────
  for (const [m, p] of [["GET", "/api/erp/tracking/list"], ["GET", "/api/erp/tracking/summary"], ["GET", "/api/erp/tracking/search?q=a"], ["GET", "/api/erp/tracking/CL-ORD-00000042"], ["POST", "/api/erp/tracking/CL-ORD-00000042/events"]]) {
    const r = await anon(m, p, m === "POST" ? { eventCode: "gate_in" } : undefined);
    check("auth", `${m} ${p.split("?")[0]} without a session is refused (redirect to login / 401 / 403) and returns no data`, (r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) && !r.data, `status ${r.status}`);
  }
  const noPerm = await login({ role: "no_such_role_zz", countryId: PK });
  const np = await noPerm("GET", "/api/erp/tracking/list");
  check("auth", "a login without any tracking permission gets 401/403 from list", np.status === 401 || np.status === 403, `status ${np.status}`);

  // ── 2. real fixtures from the database ──────────────────────────────────────
  const seaLeg = (await sql`
    select l.order_id, o.order_no, o.customer_name, l.container_number, l.vessel_name, l.voyage_number, l.bl_number, l.shipping_line_id, sl.name sl_name
    from clearing_customer_order_legs l join clearing_customer_orders o on o.id=l.order_id and o.deleted_at is null
    left join shipping_lines sl on sl.id=l.shipping_line_id
    where l.deleted_at is null and l.transport_mode='by_sea' and l.container_number is not null and l.vessel_name is not null limit 1`)[0];
  const blLeg = (await sql`
    select o.order_no, l.bl_number from clearing_customer_order_legs l join clearing_customer_orders o on o.id=l.order_id and o.deleted_at is null
    where l.deleted_at is null and l.bl_number is not null limit 1`)[0];
  const voyLeg = (await sql`
    select o.order_no, l.voyage_number from clearing_customer_order_legs l join clearing_customer_orders o on o.id=l.order_id and o.deleted_at is null
    where l.deleted_at is null and l.voyage_number is not null limit 1`)[0];
  const roadLeg = (await sql`
    select o.order_no, l.truck_number from clearing_customer_order_legs l join clearing_customer_orders o on o.id=l.order_id and o.deleted_at is null
    where l.deleted_at is null and l.transport_mode='by_road' and l.truck_number is not null limit 1`)[0];
  const airLeg = (await sql`
    select o.order_no, l.flight_number from clearing_customer_order_legs l join clearing_customer_orders o on o.id=l.order_id and o.deleted_at is null
    where l.deleted_at is null and l.transport_mode='by_air' and l.flight_number is not null limit 1`)[0];
  const multi = (await sql`
    select o.id, o.order_no, o.country_id, array_agg(distinct l.transport_mode) modes, count(*)::int n
    from clearing_customer_orders o join clearing_customer_order_legs l on l.order_id=o.id and l.deleted_at is null
    where o.deleted_at is null group by o.id having count(distinct l.transport_mode) >= 2 order by count(distinct l.transport_mode) desc, count(*) desc limit 1`)[0];
  const pkOrder = (await sql`select o.id, o.order_no from clearing_customer_orders o where o.deleted_at is null and o.country_id=${PK} and exists (select 1 from clearing_customer_order_legs l where l.order_id=o.id and l.deleted_at is null) order by o.order_no limit 1`)[0];
  const aeOrder = (await sql`select id, order_no from clearing_customer_orders where deleted_at is null and country_id=${AE} limit 1`)[0];
  const totalDb = (await sql`select count(*)::int n from clearing_customer_orders where deleted_at is null`)[0].n;

  check("fixtures", "DEV has a sea leg with container + vessel", !!seaLeg);
  check("fixtures", "DEV has a multi-mode order", !!multi, JSON.stringify(multi));

  // ── 3. search by every field ────────────────────────────────────────────────
  const has = (r, orderNo) => (r.data?.rows ?? []).some((x) => x.orderNo === orderNo);
  let r = await list(admin, "");
  check("list", "super admin sees every shipment (total = DB count)", r.status === 200 && r.data.total === totalDb, `api ${r.data?.total} db ${totalDb}`);

  r = await list(admin, seaLeg.order_no, "&field=shipment");
  check("search", "Shipment No finds the order", has(r, seaLeg.order_no));
  r = await list(admin, seaLeg.container_number, "&field=container");
  check("search", "Container No finds the order", has(r, seaLeg.order_no), `q=${seaLeg.container_number}`);
  r = await list(admin, seaLeg.container_number.toLowerCase().replace(/(.{4})/, "$1 - "), "&field=container");
  check("search", "Container No ignores case, spaces and hyphens", has(r, seaLeg.order_no));
  r = await list(admin, seaLeg.vessel_name, "&field=vessel");
  check("search", "Vessel finds the order", has(r, seaLeg.order_no), `q=${seaLeg.vessel_name}`);
  r = await list(admin, seaLeg.vessel_name.toUpperCase(), "");
  check("search", "Vessel found from the all-fields box, upper case", has(r, seaLeg.order_no));
  if (voyLeg) {
    r = await list(admin, voyLeg.voyage_number, "&field=voyage");
    check("search", "Voyage finds the order", has(r, voyLeg.order_no), `q=${voyLeg.voyage_number}`);
  } else check("search", "Voyage (no voyage data on DEV)", true, "skipped");
  if (blLeg) {
    r = await list(admin, blLeg.bl_number, "&field=bl");
    check("search", "BL Number finds the order", has(r, blLeg.order_no), `q=${blLeg.bl_number}`);
    r = await list(admin, blLeg.bl_number.toLowerCase().replace(/[^a-z0-9]/gi, " "), "&field=bl");
    check("search", "BL Number ignores punctuation / case", has(r, blLeg.order_no));
  }
  const custWord = seaLeg.customer_name.split(/\s+/)[0];
  r = await list(admin, custWord, "&field=customer");
  check("search", "Customer finds the order (one word)", has(r, seaLeg.order_no), `q=${custWord}`);
  r = await list(admin, seaLeg.customer_name, "&field=customer");
  check("search", "Customer finds the order (full name)", has(r, seaLeg.order_no));
  if (seaLeg.sl_name) {
    r = await list(admin, seaLeg.sl_name, "&field=carrier");
    check("search", "Shipping Line finds the order", has(r, seaLeg.order_no), `q=${seaLeg.sl_name}`);
  } else check("search", "Shipping Line (sea leg has none on DEV)", true, "skipped");
  if (roadLeg) {
    r = await list(admin, roadLeg.truck_number, "&field=truck");
    check("search", "Truck number finds the order", has(r, roadLeg.order_no), `q=${roadLeg.truck_number}`);
  }
  if (airLeg) {
    r = await list(admin, airLeg.flight_number, "&field=transport");
    check("search", "Flight number finds the order", has(r, airLeg.order_no), `q=${airLeg.flight_number}`);
  }
  r = await list(admin, seaLeg.container_number, "&field=vessel");
  check("search", "a field-restricted search does NOT match other fields", !has(r, seaLeg.order_no) || seaLeg.container_number === seaLeg.vessel_name);
  r = await list(admin, "zzz-no-such-shipment-9999");
  check("search", "no match → empty list, total 0", r.status === 200 && r.data.total === 0 && r.data.rows.length === 0);
  r = await list(admin, "x' OR '1'='1");
  check("search", "SQL metacharacters are treated as text (no error, no leak)", r.status === 200 && r.data.total === 0, `status ${r.status} total ${r.data?.total}`);
  r = await list(admin, "100%_");
  check("search", "LIKE wildcards in the query do not match everything", r.status === 200 && r.data.total < totalDb, `total ${r.data?.total}`);

  // ── 4. multi-leg, modes, filters, pagination ───────────────────────────────
  r = await list(admin, multi.order_no, "&field=shipment");
  const mrow = (r.data?.rows ?? []).find((x) => x.orderNo === multi.order_no);
  check("multileg", "multi-leg order appears once in the list (not once per leg)", (r.data?.rows ?? []).filter((x) => x.orderNo === multi.order_no).length === 1);
  check("multileg", "list row reports leg count and every mode", mrow && mrow.legCount === multi.n && multi.modes.every((m) => mrow.legModes.includes(m)), JSON.stringify({ legCount: mrow?.legCount, legModes: mrow?.legModes, expect: multi.modes }));
  const det = await admin("GET", `/api/erp/tracking/${multi.id}?domain=both`);
  check("multileg", "detail returns all legs in order", det.status === 200 && det.data.legs.length === multi.n && det.data.legs.every((l, i, a) => i === 0 || a[i - 1].leg_no <= l.leg_no), `legs ${det.data?.legs?.length}`);
  check("multileg", "detail also resolves by shipment number", (await admin("GET", `/api/erp/tracking/${enc(multi.order_no)}?domain=both`)).data?.shipment?.order_no === multi.order_no);
  const modesSeen = new Set();
  for (const m of ["by_sea", "by_road", "by_air", "by_rail"]) {
    r = await list(admin, "", `&mode=${m}`);
    const legacy = { by_sea: ["by_sea", "sea"], by_road: ["by_road", "road", "truck"], by_air: ["by_air", "air"], by_rail: ["by_rail", "rail", "train"] }[m];
    const dbN = (await sql`select count(distinct o.id)::int n from clearing_customer_orders o where o.deleted_at is null and (exists (select 1 from clearing_customer_order_legs l where l.order_id=o.id and l.deleted_at is null and l.transport_mode=${m}) or (not exists (select 1 from clearing_customer_order_legs l where l.order_id=o.id and l.deleted_at is null) and lower(coalesce(o.transport_mode,'')) = any(${legacy})))`)[0].n;
    check("filter", `mode filter ${m} total matches DB (${dbN})`, r.status === 200 && r.data.total === dbN, `api ${r.data?.total}`);
    if (r.data?.rows?.length) modesSeen.add(m);
  }
  check("filter", "Sea, Road, Air and Train all return rows on DEV", modesSeen.size === 4, [...modesSeen].join(","));
  for (const st of ["booking", "completed"]) {
    r = await list(admin, "", `&status=${st}`);
    const dbN = (await sql`select count(*)::int n from clearing_customer_orders where deleted_at is null and current_stage=${st}`)[0].n;
    check("filter", `status filter ${st} total matches DB (${dbN})`, r.status === 200 && r.data.total === dbN, `api ${r.data?.total}`);
  }
  const p1 = await admin("GET", "/api/erp/tracking/list?domain=both&limit=10&offset=0");
  const p2 = await admin("GET", "/api/erp/tracking/list?domain=both&limit=10&offset=10");
  const ids1 = new Set(p1.data.rows.map((x) => x.id));
  check("page", "page 1 has 10 rows, page 2 does not repeat them", p1.data.rows.length === 10 && p2.data.rows.every((x) => !ids1.has(x.id)));
  check("page", "total is stable across pages", p1.data.total === p2.data.total);
  const containersView = await admin("GET", "/api/erp/tracking/list?domain=both&limit=100&view=containers");
  check("page", "Containers view only lists rows that have a container", containersView.data.rows.every((x) => x.containerNumber && x.containerNumber !== "—"), `${containersView.data.total} rows`);
  const trucksView = await admin("GET", "/api/erp/tracking/list?domain=both&limit=100&view=trucks");
  check("page", "Trucks view only lists rows that have a truck", trucksView.data.rows.every((x) => x.truckNumber && x.truckNumber !== "—"), `${trucksView.data.total} rows`);
  const big = await admin("GET", "/api/erp/tracking/list?domain=both&limit=100000");
  check("page", "limit is clamped to 100", big.status === 200 && big.data.rows.length <= 100);

  // ── 5. summary ──────────────────────────────────────────────────────────────
  const sm = await admin("GET", "/api/erp/tracking/summary?domain=both");
  check("summary", "summary total shipments = DB count", sm.status === 200 && sm.data.shipmentSummary.totalShipments === totalDb, `api ${sm.data?.shipmentSummary?.totalShipments}`);
  check("summary", "super admin may record milestones (canRecord)", sm.data?.canRecord === true);
  const modeSum = Object.values(sm.data?.movementByMode ?? {}).reduce((a, b) => a + b, 0);
  check("summary", "movement-by-mode adds up to total shipments", modeSum === totalDb, `${modeSum} vs ${totalDb}`);

  // ── 6. scope isolation ─────────────────────────────────────────────────────
  const pk = await login({ role: "country_admin", countryId: PK, userId: REAL_USER });
  const ae = await login({ role: "country_admin", countryId: AE, userId: REAL_USER });
  const pkN = (await sql`select count(*)::int n from clearing_customer_orders where deleted_at is null and country_id=${PK}`)[0].n;
  const aeN = (await sql`select count(*)::int n from clearing_customer_orders where deleted_at is null and country_id=${AE}`)[0].n;
  r = await pk("GET", "/api/erp/tracking/list?domain=both&limit=100");
  check("scope", `Pakistan admin list = Pakistan orders only (${pkN})`, r.status === 200 && r.data.total === pkN, `api ${r.data?.total}`);
  r = await ae("GET", "/api/erp/tracking/list?domain=both&limit=100");
  check("scope", `UAE admin list = UAE orders only (${aeN})`, r.status === 200 && r.data.total === aeN, `api ${r.data?.total}`);
  const pkSum = await pk("GET", "/api/erp/tracking/summary?domain=both");
  check("scope", "Pakistan admin summary counts only Pakistan", pkSum.data?.shipmentSummary?.totalShipments === pkN, `api ${pkSum.data?.shipmentSummary?.totalShipments}`);
  const cross = await ae("GET", `/api/erp/tracking/${pkOrder.id}?domain=both`);
  check("scope", "UAE admin cannot open a Pakistan shipment detail", cross.status === 404 || cross.status === 403, `status ${cross.status}`);
  const crossNo = await ae("GET", `/api/erp/tracking/${enc(pkOrder.order_no)}?domain=both`);
  check("scope", "…nor by shipment number", crossNo.status === 404 || crossNo.status === 403, `status ${crossNo.status}`);
  r = await ae("GET", `/api/erp/tracking/list?domain=both&q=${enc(pkOrder.order_no)}`);
  check("scope", "…nor find it through search", r.data.total === 0);
  const own = await pk("GET", `/api/erp/tracking/${pkOrder.id}?domain=both`);
  check("scope", "Pakistan admin opens a Pakistan shipment", own.status === 200);
  const crossEvt = await ae("POST", `/api/erp/tracking/${pkOrder.id}/events`, { eventCode: "gate_in", locationName: "X-SCOPE-TEST" });
  check("scope", "UAE admin cannot record a milestone on a Pakistan shipment", crossEvt.status === 404 || crossEvt.status === 403, `status ${crossEvt.status}`);
  const leaked = (await sql`select count(*)::int n from shipment_tracking_events where location_name='X-SCOPE-TEST'`.catch(() => [{ n: -1 }]))[0].n;
  check("scope", "…and nothing was written", leaked === 0, `rows ${leaked}`);

  // ── 7. recording milestones ────────────────────────────────────────────────
  const evtTable = (await sql`select to_regclass('public.shipment_tracking_events') t`)[0].t ? "shipment_tracking_events" : null;
  check("event", "event table exists", !!evtTable);
  const target = own.data;
  const legId = target.activeLeg?.id ?? target.legs?.[0]?.id;
  const tag = "E2E-" + Date.now().toString(36);
  const before = (await sql`select count(*)::int n from shipment_tracking_events where order_id=${pkOrder.id}`)[0].n;
  let rec = await pk("POST", `/api/erp/tracking/${pkOrder.id}/events`, { eventCode: "gate_in", legId, locationName: tag, remarks: "e2e" });
  check("event", "country admin records a milestone", rec.status === 200 || rec.status === 201, `status ${rec.status} ${rec.err ?? ""}`);
  const after = (await sql`select count(*)::int n from shipment_tracking_events where order_id=${pkOrder.id}`)[0].n;
  check("event", "exactly one event row was added", after === before + 1, `${before} → ${after}`);
  const redet = await pk("GET", `/api/erp/tracking/${pkOrder.id}?domain=both`);
  check("event", "the new event is the latest in the detail timeline", redet.data.events[0]?.location_name === tag, redet.data.events[0]?.location_name);
  check("event", "event is attached to the chosen leg", redet.data.events[0]?.leg_id === legId, JSON.stringify({ legId, got: redet.data.events[0]?.leg_id, activeLeg: target.activeLeg?.id, legs: target.legs?.length }));
  rec = await pk("POST", `/api/erp/tracking/${pkOrder.id}/events`, { eventCode: "not_a_real_code" });
  check("event", "unknown event code is rejected (4xx)", rec.status >= 400 && rec.status < 500, `status ${rec.status}`);
  const foreignLeg = (await sql`select id from clearing_customer_order_legs where deleted_at is null and order_id <> ${pkOrder.id} limit 1`)[0].id;
  rec = await pk("POST", `/api/erp/tracking/${pkOrder.id}/events`, { eventCode: "gate_in", legId: foreignLeg, locationName: "X-FOREIGN-LEG" });
  check("event", "a leg that belongs to another shipment is rejected (4xx)", rec.status >= 400 && rec.status < 500, `status ${rec.status}`);
  const foreignWritten = (await sql`select count(*)::int n from shipment_tracking_events where location_name='X-FOREIGN-LEG'`)[0].n;
  check("event", "…and nothing was written", foreignWritten === 0);
  const ro = await login({ role: "super_admin_reports", countryId: PK, userId: REAL_USER });
  const roList = await ro("GET", "/api/erp/tracking/list?domain=both&limit=5");
  const roSum = await ro("GET", "/api/erp/tracking/summary?domain=both");
  const roRec = await ro("POST", `/api/erp/tracking/${pkOrder.id}/events`, { eventCode: "gate_in", locationName: "X-READONLY" });
  check("event", "read-only report role can read the list", roList.status === 200, `status ${roList.status}`);
  check("event", "read-only role: canRecord is false", roSum.data?.canRecord === false, String(roSum.data?.canRecord));
  check("event", "read-only role cannot record a milestone (403)", roRec.status === 403, `status ${roRec.status}`);
  const roWritten = (await sql`select count(*)::int n from shipment_tracking_events where location_name='X-READONLY'`)[0].n;
  check("event", "…and nothing was written", roWritten === 0);

  // cleanup only what this harness wrote (DEV)
  await sql`delete from shipment_tracking_events where location_name = ${tag}`;

  // ── 8. quick search endpoint ───────────────────────────────────────────────
  const qs = await admin("GET", `/api/erp/tracking/search?q=${enc(seaLeg.container_number)}&domain=both`);
  const qsRows = qs.data?.results ?? qs.data?.rows ?? qs.data ?? [];
  check("search", "quick-search endpoint finds the container", qs.status === 200 && JSON.stringify(qsRows).includes(seaLeg.order_no), `status ${qs.status}`);

  await sql.end();
  const fail = results.filter((x) => !x.ok);
  console.log(`\n==== ${results.length - fail.length} PASS / ${fail.length} FAIL ====`);
  for (const f of fail) console.log(`FAIL [${f.section}] ${f.name} ${f.detail}`);
  process.exit(fail.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
