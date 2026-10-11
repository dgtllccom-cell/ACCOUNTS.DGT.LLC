/**
 * Store-review pass — end-to-end check (DEV ONLY).
 * A pass lets an Apple / Google / Samsung reviewer activate their OWN phone for ONE limited reviewer login, for a limited time and number of
 * devices, without waiting for the Super Admin. Drives a DEV server (ALLOW_DEV_SESSION=true) with the User-Agent tag of the store apps and the
 * real DEV database. Test rows are removed at the end.
 *   BASE=http://localhost:3260 node scripts/e2e-review-pass.mjs
 */
import fs from "node:fs";
import postgres from "postgres";

const BASE = process.env.BASE || "http://localhost:3260";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("DEV only"); process.exit(2); }
const envUrl = () => process.env.DATABASE_URL || fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g, "");
const URL_ = envUrl();
if (!/csesvyxxjivnkkozgopt/.test(URL_)) { console.error("REFUSING: DATABASE_URL is not the DEV project"); process.exit(2); }
const sql = postgres(URL_, { max: 2, prepare: false, ssl: "require" });

const UA_B = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-B/1";
const UA_BS = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-BS/1";
const UA_WEB = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const USER1 = "00000000-0000-4000-8000-000000000001";
const IDENT = "country_admin@dev.local"; // the e-mail a dev-session country_admin carries
const RUN = Date.now().toString(36);

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };
const jar = (setCookies) => (setCookies ?? []).map((c) => c.split(";")[0]).join("; ");
let ipN = 0;
const nextIp = () => `10.99.${(Date.now() >> 8) & 255}.${++ipN}`; // a distinct caller per scenario so the per-IP throttle is not what we measure
async function call(method, path, { ua = UA_B, cookie = "", body, ip } = {}) {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "user-agent": ua, cookie, "content-type": "application/json", "x-forwarded-for": ip ?? nextIp() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await r.text().catch(() => "");
  let json = null; try { json = JSON.parse(raw); } catch { /* html */ }
  return { status: r.status, loc: r.headers.get("location") || "", json, setCookie: r.headers.getSetCookie?.() ?? [], text: raw };
}
const devSession = async (body) => jar((await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).headers.getSetCookie());
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const admin = await devSession({ role: "super_admin" });
const notAdmin = await devSession({ role: "country_admin", userId: USER1 });
const userSession = notAdmin; // the reviewer login (IDENT) as a signed-in ERP session
const DATA = "/api/erp/tracking/summary?domain=both";
const createdPasses = [];
const mkPass = async (over = {}) => {
  const r = await call("POST", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: admin, body: { app: "b", label: `e2e ${RUN}`, identifier: IDENT, days: 7, maxDevices: 3, ...over } });
  if (r.json?.data?.id) createdPasses.push(r.json.data.id);
  return r;
};
const redeem = (code, { ua = UA_B, identifier = IDENT } = {}) => call("POST", "/api/erp/auth/device/request", { ua, body: { name: "Store Reviewer", identifier, platform: "ios", model: "iPhone", reviewCode: code } });

// 1. creating passes is Super-Admin only and validated
let r = await call("POST", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: notAdmin, body: { app: "b", label: "x1", identifier: IDENT } });
check("Non-super-admin cannot create a pass (403)", r.status === 403, `status ${r.status}`);
r = await call("GET", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: notAdmin });
check("Non-super-admin cannot list passes (403)", r.status === 403, `status ${r.status}`);
r = await call("POST", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: admin, body: { app: "zz", label: "x", identifier: IDENT } });
check("Unknown app / bad data is rejected (4xx)", r.status >= 400 && r.status < 500, `status ${r.status}`);
r = await call("POST", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: admin, body: { app: "b", label: "x", identifier: IDENT, days: 400 } });
check("Validity above 90 days is rejected", r.status >= 400 && r.status < 500, `status ${r.status}`);

// 2. create + storage
r = await mkPass();
const code = r.json?.data?.code, passId = r.json?.data?.id;
check("Super Admin creates a pass; the code is XXXX-XXXX-XXXX", r.status === 200 && /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(code ?? ""), JSON.stringify(r.json)?.slice(0, 120));
const row = (await sql`select * from mobile_review_passes where id = ${passId}::uuid`)[0];
check("The code is stored only as a hash", !!row?.code_hash && !JSON.stringify(row).includes(code.replace(/-/g, "")));
r = await call("GET", "/api/erp/mobile-devices/review-passes", { ua: UA_WEB, cookie: admin });
check("List shows the pass without any code or hash", r.status === 200 && r.json?.data?.passes?.some((p) => p.id === passId) && !/code_hash|"code"/.test(JSON.stringify(r.json)), `status ${r.status}`);

// 3. redeem rules
r = await call("POST", "/api/erp/auth/device/request", { body: { name: "Plain User", identifier: IDENT } });
check("Control: a request WITHOUT a review code stays pending", r.json?.data?.status === "pending", JSON.stringify(r.json)?.slice(0, 100));
const pendingId = jar(r.setCookie).match(/dgt_device=([0-9a-f-]{36})/i)?.[1];
r = await redeem("AAAA-BBBB-CCCC");
check("A wrong review code is refused (401)", r.status === 401 && r.json?.error?.code === "REVIEW_CODE_INVALID", `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 80)}`);
const fa = (await sql`select failed_attempts from mobile_review_passes where id = ${passId}::uuid`)[0].failed_attempts;
check("…and the failed attempt is counted", fa === 1, String(fa));
r = await redeem(code, { identifier: "someone.else@example.com" });
check("The code is tied to ONE login: another e-mail is refused", r.status === 401, `status ${r.status}`);
r = await redeem(code, { ua: UA_BS });
check("The code is tied to ONE app: the other app is refused", r.status === 401, `status ${r.status}`);

r = await redeem(code.toLowerCase().replace(/-/g, " "));
const devCookie = jar(r.setCookie);
const devId = devCookie.match(/dgt_device=([0-9a-f-]{36})/i)?.[1];
check("The right code (any case / spacing) activates the device at once", r.status === 200 && r.json?.data?.status === "active" && !!devId, JSON.stringify(r.json)?.slice(0, 120));
const drow = (await sql`select status, review_pass_id, approved_by, bound_user_id from mobile_devices where id = ${devId}::uuid`)[0];
check("Device row: active, linked to the pass, no human approver needed", drow?.status === "active" && drow.review_pass_id === passId, JSON.stringify(drow));
r = await call("GET", "/auth/login", { cookie: devCookie });
check("Activated device: login screen opens (no redirect to activation)", r.status === 200 && !/\/auth\/device/.test(r.loc + r.text.slice(0, 400)), JSON.stringify({ s: r.status, l: r.loc }));
r = await call("GET", DATA, { cookie: devCookie + "; " + userSession });
check("Reviewer device + the reviewer ERP login → data served", r.status === 200 && r.json?.ok === true, `status ${r.status}`);
r = await call("GET", DATA, { cookie: devCookie });
check("Reviewer device WITHOUT an ERP login → no data", !r.json?.ok, `status ${r.status}`);
const otherLogin = await devSession({ role: "country_admin", userId: "00000000-0000-4000-8000-000000000002" });
r = await call("GET", DATA, { cookie: devCookie + "; " + otherLogin });
check("Pass device + a DIFFERENT ERP user → no data (pass does not widen access)", !r.json?.ok, `status ${r.status}`);
const pu = (await sql`select used_devices from mobile_review_passes where id = ${passId}::uuid`)[0].used_devices;
check("Pass usage counter = 1 device", pu === 1, String(pu));
check("Control pending request was NOT activated by the pass", (await sql`select status from mobile_devices where id = ${pendingId}::uuid`)[0].status === "pending");

// 4. device limit
r = await mkPass({ maxDevices: 2, label: `e2e limit ${RUN}` });
const codeL = r.json?.data?.code;
const s1 = (await redeem(codeL)).status, s2 = (await redeem(codeL)).status;
r = await redeem(codeL);
check("Device limit: 2 devices activate, the 3rd is refused (409)", s1 === 200 && s2 === 200 && r.status === 409 && r.json?.error?.code === "REVIEW_CODE_FULL", `${s1},${s2},${r.status}`);

// 5. lock-out after repeated wrong codes (counter pre-set so the per-IP throttle is not what is measured)
r = await mkPass({ label: `e2e lock ${RUN}` });
const codeK = r.json?.data?.code, idK = r.json?.data?.id;
await sql`update mobile_review_passes set failed_attempts = 9 where id = ${idK}::uuid`;
await redeem("ZZZZ-ZZZZ-ZZZZ");
r = await redeem(codeK);
check("After 10 wrong codes the pass is locked — even the right code is refused", r.status === 401, `status ${r.status}`);

// 6. expiry ends access (also for devices already activated with the pass)
r = await mkPass({ label: `e2e expiry ${RUN}` });
const codeE = r.json?.data?.code, idE = r.json?.data?.id;
r = await redeem(codeE);
const cookieE = jar(r.setCookie);
r = await call("GET", DATA, { cookie: cookieE + "; " + userSession });
check("Second reviewer device: data served while the pass is valid", r.json?.ok === true, `status ${r.status}`);
await sql`update mobile_review_passes set expires_at = now() - interval '1 minute' where id = ${idE}::uuid`;
await wait(9000); // per-process device status cache is 8 s
r = await call("GET", DATA, { cookie: cookieE + "; " + userSession });
check("Pass expired → the activated device gets no data on the next request", !r.json?.ok, `status ${r.status}`);
r = await redeem(codeE);
check("Pass expired → the code can no longer be redeemed", r.status === 401, `status ${r.status}`);

// 7. revoke blocks the pass AND its devices
r = await call("POST", `/api/erp/mobile-devices/review-passes/${passId}/revoke`, { ua: UA_WEB, cookie: notAdmin });
check("Non-super-admin cannot revoke (403)", r.status === 403, `status ${r.status}`);
r = await call("POST", `/api/erp/mobile-devices/review-passes/${passId}/revoke`, { ua: UA_WEB, cookie: admin });
check("Super Admin revokes the pass → its device is blocked", r.status === 200 && r.json?.data?.devicesBlocked === 1, JSON.stringify(r.json));
await wait(9000);
r = await call("GET", DATA, { cookie: devCookie + "; " + userSession });
check("Revoked pass → the reviewer device gets no data", !r.json?.ok, `status ${r.status}`);
r = await call("GET", "/api/erp/auth/device/status", { cookie: devCookie });
check("Revoked pass → device status = revoked", r.json?.data?.status === "revoked", JSON.stringify(r.json)?.slice(0, 80));
r = await redeem(code);
check("Revoked pass → the code can no longer be redeemed", r.status === 401, `status ${r.status}`);
r = await call("POST", `/api/erp/mobile-devices/review-passes/${passId}/revoke`, { ua: UA_WEB, cookie: admin });
check("Revoking twice is refused (409)", r.status === 409, `status ${r.status}`);

// 8. audit trail + clean-up (DEV test rows only)
const ev = new Set((await sql`select event from mobile_device_events where device_id = ${devId}::uuid`).map((e) => e.event));
check("Audit trail: requested / review_pass_activated / revoked", ["requested", "review_pass_activated", "revoked"].every((e) => ev.has(e)), [...ev].join(","));
await sql`delete from mobile_devices where review_pass_id = any(${createdPasses}::uuid[]) or id = ${pendingId}::uuid`;
await sql`delete from mobile_review_passes where id = any(${createdPasses}::uuid[])`;
await sql.end();
const bad = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - bad} PASS / ${bad} FAIL ====`);
process.exit(bad ? 1 : 0);
