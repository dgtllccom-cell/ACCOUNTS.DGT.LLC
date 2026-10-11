/**
 * Store-reviewer login — end-to-end proof (DEV ONLY).
 * Creates a read-only Reports Auditor (`auditor_viewer`, finance amounts denied, operational domain "both", scoped to a country that has NO data)
 * and checks what an Apple / Google / Samsung reviewer would really get through the store apps: activation with a review pass, sign-in,
 * then empty lists, no financial data, and no way to write, manage users, approve devices or read another country.
 *   BASE=http://127.0.0.1:3250 node scripts/e2e-reviewer-account.mjs        (needs a DEV server with ALLOW_DEV_SESSION=true)
 * The temporary login, pass and devices are removed at the end. The password is random and never printed.
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const BASE = process.env.BASE || "http://127.0.0.1:3250";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("DEV only"); process.exit(2); }
const envUrl = () => process.env.DATABASE_URL || fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const URL_ = envUrl();
if (!/csesvyxxjivnkkozgopt/.test(URL_)) { console.error("REFUSING: DATABASE_URL is not the DEV project"); process.exit(2); }
const sql = postgres(URL_, { max: 2, prepare: false, ssl: "require" });

const UA = { b: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-B/1", bs: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-BS/1", web: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36" };
const RUN = Date.now().toString(36);
const EMAIL = `app.review.${RUN}@dev.local`;
const PASSWORD = "Rv" + randomBytes(9).toString("base64url") + "9!";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };
const jar = (sc) => (sc ?? []).map((c) => c.split(";")[0]).join("; ");
let n = 0;
async function call(method, path, { ua = UA.web, cookie = "", body } = {}) {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "user-agent": ua, cookie, "content-type": "application/json", "x-forwarded-for": `10.98.${Date.now() % 250}.${++n}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await r.text().catch(() => "");
  let json = null; try { json = JSON.parse(raw); } catch { /* html */ }
  return { status: r.status, json, setCookie: r.headers.getSetCookie?.() ?? [], text: raw };
}
const devSession = async (b) => jar((await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).headers.getSetCookie());
// rows a response really carries (any array in data / data.<key>)
const rows = (j) => { const d = j?.data; if (Array.isArray(d)) return d.length; if (d && typeof d === "object") return Object.values(d).filter(Array.isArray).reduce((a, x) => a + x.length, 0); return 0; };

// the empty scope: a country with no branches, users, customers or accounts
const empty = (await sql`
  select c.id, c.name from countries c
  where not exists (select 1 from country_branches b where b.country_id = c.id)
    and not exists (select 1 from user_role_assignments a where a.country_id = c.id and a.deleted_at is null)
    and not exists (select 1 from customers x where x.country_id = c.id)
    and not exists (select 1 from roznamcha_lines rl join ledgers l on l.id = rl.ledger_id where l.country_id = c.id)   -- every country auto-gets 3 ledgers; they must have no postings
  order by c.name limit 1`)[0];
const busy = (await sql`select c.id, c.name from countries c where exists (select 1 from customers x where x.country_id = c.id) order by c.name limit 1`)[0];
check("DEV has an empty country to use as the review scope", !!empty, "none");
check("…and a country WITH data to prove the reviewer cannot see it", !!busy, "none");

const admin = await devSession({ role: "super_admin" });
let userId = null, passId = null;
try {
  let r = await call("POST", "/api/erp/users", { cookie: admin, body: { role: "auditor_viewer", fullName: "App Review Account", email: EMAIL, password: PASSWORD, countryId: empty.id, operationalDomain: "both", financialAccess: "deny" } });
  userId = r.json?.data?.id ?? r.json?.data?.userId ?? r.json?.data?.user?.id ?? null;
  check("Super Admin creates the reviewer login (Reports Auditor, domain both, finance denied)", r.status === 200 || r.status === 201, `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
  if (!userId) userId = (await sql`select id from profiles where lower(email) = ${EMAIL} limit 1`)[0]?.id ?? null;
  check("The login exists", !!userId);
  const asg = (await sql`select role, country_id, country_branch_id, operational_domain from user_role_assignments where user_id = ${userId}::uuid and deleted_at is null`)[0];
  check("Assignment: read-only auditor role, empty country, no branch", asg?.role === "auditor_viewer" && asg.country_id === empty.id && !asg.country_branch_id, JSON.stringify(asg));
  const perms = (await sql`select permissions from user_permission_sets where user_id = ${userId}::uuid`)[0]?.permissions ?? [];
  const writes = (perms || []).filter((p) => /:(create|update|delete|post|approve)$/.test(p));
  check("Permission set has NO create / update / delete / post / approve and denies finance amounts", writes.length === 0 && (perms || []).includes("finance_amounts:deny"), JSON.stringify({ writes, deny: (perms || []).includes("finance_amounts:deny"), n: (perms || []).length }));

  // the store-app front door: a review pass activates the phone, the reviewer then signs in with the login
  const sessions = {};
  for (const app of ["b", "bs"]) {
    r = await call("POST", "/api/erp/mobile-devices/review-passes", { cookie: admin, body: { app, label: `e2e reviewer ${app} ${RUN}`, identifier: EMAIL, days: 2, maxDevices: 2 } });
    const code = r.json?.data?.code; if (r.json?.data?.id) passId = passId ? [].concat(passId, r.json.data.id) : r.json.data.id;
    r = await call("POST", "/api/erp/auth/device/request", { ua: UA[app], body: { name: "Store Reviewer", identifier: EMAIL, reviewCode: code, platform: "ios", model: "iPhone" } });
    const dev = jar(r.setCookie);
    check(`App ${app.toUpperCase()}: the review pass activates the reviewer's phone`, r.json?.data?.status === "active", JSON.stringify(r.json)?.slice(0, 120));
    r = await call("POST", "/api/erp/auth/login", { ua: UA[app], cookie: dev, body: { identifier: EMAIL, password: PASSWORD } });
    const sess = jar(r.setCookie);
    check(`App ${app.toUpperCase()}: the reviewer signs in with the reviewer login (domain "both" passes the app gate)`, r.status === 200 && /erp_session|sb-|erp/.test(sess), `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 160)}`);
    sessions[app] = { dev, sess, ck: `${dev}; ${sess}` };
  }
  const ck = sessions.b.ck;

  // what the reviewer can see: nothing of the business
  const READS = ["/api/erp/customers", "/api/erp/accounts", "/api/erp/ledgers", "/api/erp/companies", "/api/erp/roznamcha", "/api/erp/tracking/summary?domain=both"];
  for (const path of READS) {
    r = await call("GET", path, { ua: UA.b, cookie: ck });
    if (path === "/api/erp/ledgers") {
      // every country owns 3 auto-created ledger shells; the reviewer may see ONLY the review country's, and they must hold no postings
      const list = r.json?.data?.ledgers ?? [];
      const ids = list.map((l) => l.id);
      const foreign = list.filter((l) => l.country_id !== empty.id).length;
      const lines = ids.length ? (await sql`select count(*)::int as n from roznamcha_lines where ledger_id = any(${ids}::uuid[])`)[0].n : 0;
      check(`Read /api/erp/ledgers: only the review country's empty ledger shells (${list.length} shells, ${foreign} foreign, ${lines} postings)`, r.status === 200 && foreign === 0 && lines === 0, JSON.stringify({ foreign, lines }));
      continue;
    }
    check(`Read ${path.split("?")[0]}: no business rows (${r.status}, ${rows(r.json)} rows)`, r.status < 500 && rows(r.json) === 0, JSON.stringify(r.json)?.slice(0, 160));
  }
  if (busy) {
    r = await call("GET", `/api/erp/customers?countryId=${busy.id}`, { ua: UA.b, cookie: ck });
    check(`Asking for another country's customers (${busy.name}) returns nothing`, r.status < 500 && rows(r.json) === 0, `status ${r.status} rows ${rows(r.json)}`);
    r = await call("GET", `/api/erp/accounts?countryId=${busy.id}`, { ua: UA.b, cookie: ck });
    check(`Asking for another country's accounts returns nothing`, r.status < 500 && rows(r.json) === 0, `status ${r.status} rows ${rows(r.json)}`);
  }
  // …and cannot change or manage anything
  const WRITES = [
    ["POST", "/api/erp/customers", { name: "x" }], ["POST", "/api/erp/roznamcha", { amount: 1 }], ["POST", "/api/erp/accounts", { name: "x" }],
    ["GET", "/api/erp/users", undefined], ["POST", "/api/erp/users", { role: "super_admin" }], ["GET", "/api/erp/mobile-devices", undefined],
    ["POST", "/api/erp/mobile-devices/review-passes", { app: "b", label: "x", identifier: "x@y.z" }],
  ];
  for (const [m, path, body] of WRITES) {
    r = await call(m, path, { ua: UA.b, cookie: ck, body });
    check(`${m} ${path} is refused (${r.status}${r.status === 403 ? " forbidden" : " rejected before any write"})`, r.status >= 400 && r.status < 500, `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
  }
  // the pass does not let a different login use the reviewer's phone
  const other = await devSession({ role: "country_admin", userId: "00000000-0000-4000-8000-000000000001" });
  r = await call("GET", "/api/erp/tracking/summary?domain=both", { ua: UA.b, cookie: `${sessions.b.dev}; ${other}` });
  check("The reviewer's phone cannot be used by another ERP login", !r.json?.ok, `status ${r.status}`);
} finally {
  if (userId) await call("DELETE", `/api/erp/users?userId=${userId}`, { cookie: admin }).catch(() => {});
  const ids = [].concat(passId ?? []);
  if (ids.length) {
    await sql`delete from mobile_devices where review_pass_id = any(${ids}::uuid[])`;
    await sql`delete from mobile_review_passes where id = any(${ids}::uuid[])`;
  }
  await sql`delete from mobile_devices where requested_identifier = ${EMAIL}`;
  await sql.end();
}
const bad = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - bad} PASS / ${bad} FAIL ====`);
process.exit(bad ? 1 : 0);
