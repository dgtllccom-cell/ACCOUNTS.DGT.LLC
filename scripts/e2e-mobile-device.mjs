/**
 * Mobile Device Approval & Activation — end-to-end check (DEV ONLY).
 * Drives a DEV server (ALLOW_DEV_SESSION=true) with the User-Agent tag of the DGT.llc B / BS store apps and the real database
 * (tables mobile_devices / mobile_device_events). Test rows are removed at the end.
 *   BASE=http://localhost:3260 node scripts/e2e-mobile-device.mjs
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
const USER2 = "00000000-0000-4000-8000-000000000002";
const IDENT = "country_admin@dev.local"; // the e-mail a dev-session country_admin carries

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };

const jar = (setCookies) => (setCookies ?? []).map((c) => c.split(";")[0]).join("; ");
async function call(method, path, { ua = UA_B, cookie = "", body } = {}) {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "user-agent": ua, cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await r.text().catch(() => "");
  let json = null; try { json = JSON.parse(raw); } catch { /* html / redirect */ }
  return { status: r.status, loc: r.headers.get("location") || "", json, setCookie: r.headers.getSetCookie?.() ?? [], text: raw };
}
const devSession = async (body) => jar((await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).headers.getSetCookie());

const admin = await devSession({ role: "super_admin" });
const notAdmin = await devSession({ role: "country_admin", userId: USER1 });
const userSession = await devSession({ role: "country_admin", userId: USER1 });   // IDENT
const otherUser = await devSession({ role: "country_admin", userId: USER2 });

// 1. nothing is reachable before activation
let r = await call("GET", "/auth/login");
const toDevice = (x) => /\/auth\/device/.test(x.loc) || (/NEXT_REDIRECT/.test(x.text) && /\/auth\/device/.test(x.text));
check("App without a device: login screen redirects to /auth/device", toDevice(r), JSON.stringify({ s: r.status, l: r.loc }));
r = await call("GET", "/auth/device");
check("Activation screen is public (200)", r.status === 200, `status ${r.status}`);
r = await call("POST", "/api/erp/auth/device/request", { ua: UA_WEB, body: { name: "Web Tester", identifier: IDENT } });
check("A plain browser cannot request activation (400)", r.status === 400, `status ${r.status}`);
r = await call("POST", "/api/erp/auth/device/request", { body: { name: "X", identifier: "a" } });
check("Bad request data is rejected (422)", r.status === 422, `status ${r.status}`);

// 2. request
r = await call("POST", "/api/erp/auth/device/request", { body: { name: "E2E Tester", phone: "+971500000000", identifier: IDENT, note: "e2e", platform: "android", model: "Pixel" } });
const devCookie = jar(r.setCookie);
check("Activation request accepted → pending + device cookie", r.status === 200 && r.json?.data?.status === "pending" && /dgt_device=/.test(devCookie), JSON.stringify(r.json));
const deviceId = devCookie.match(/dgt_device=([0-9a-f-]{36})/i)?.[1];
check("Device cookie is httpOnly + signed", r.setCookie.some((c) => /httponly/i.test(c)) && /dgt_device=[0-9a-f-]{36}\./i.test(devCookie));
r = await call("GET", "/api/erp/auth/device/status", { cookie: devCookie });
check("Status = pending", r.json?.data?.status === "pending");
r = await call("GET", "/api/erp/auth/device/status", { cookie: "dgt_device=" + deviceId + ".forged" });
check("A forged device cookie is treated as no device", r.json?.data?.status === "none");

// 3. no ERP access while pending
r = await call("POST", "/api/erp/auth/login", { cookie: devCookie, body: { identifier: IDENT, password: "x" } });
check("Pending device cannot sign in (403 DEVICE_NOT_ACTIVATED)", r.status === 403 && r.json?.error?.code === "DEVICE_NOT_ACTIVATED", JSON.stringify(r.json));
r = await call("GET", "/auth/login", { cookie: devCookie });
check("Pending device: login screen still redirects to activation", toDevice(r));
r = await call("POST", "/api/erp/auth/device/activate", { cookie: devCookie, body: { code: "123456" } });
check("Code before approval is refused (409)", r.status === 409, `status ${r.status}`);
r = await call("GET", "/api/erp/tracking/summary?domain=both", { cookie: devCookie + "; " + userSession });
check("Pending device + a valid ERP session still gets NO data", !r.json?.ok, `status ${r.status} ${JSON.stringify(r.json)?.slice(0, 80)}`);

// 4. only the Super Admin manages devices
r = await call("GET", "/api/erp/mobile-devices", { ua: UA_WEB, cookie: notAdmin });
check("Non-super-admin cannot list devices (403)", r.status === 403, `status ${r.status}`);
r = await call("POST", `/api/erp/mobile-devices/${deviceId}/approve`, { ua: UA_WEB, cookie: notAdmin, body: {} });
check("Non-super-admin cannot approve (403)", r.status === 403, `status ${r.status}`);
r = await call("GET", "/api/erp/mobile-devices?status=pending", { ua: UA_WEB, cookie: admin });
check("Super Admin sees the pending request", r.status === 200 && r.json?.data?.devices?.some((d) => d.id === deviceId) && !JSON.stringify(r.json).includes("code_hash\":\""), `status ${r.status}`);

// 5. approve + code rules
r = await call("POST", `/api/erp/mobile-devices/${deviceId}/approve`, { ua: UA_WEB, cookie: admin, body: { note: "e2e" } });
const code1 = r.json?.data?.code;
check("Approve returns a 6-digit code (shown once)", r.status === 200 && /^\d{6}$/.test(code1 ?? ""), JSON.stringify(r.json));
const hashStored = (await sql`select code_hash from mobile_devices where id = ${deviceId}::uuid`)[0]?.code_hash;
check("The code is stored only as a hash", !!hashStored && !hashStored.includes(code1));
r = await call("GET", "/api/erp/auth/device/status", { cookie: devCookie });
check("Status = approved", r.json?.data?.status === "approved");
const wrong = code1 === "000000" ? "111111" : "000000";
const codes = [];
for (let i = 0; i < 5; i++) codes.push((await call("POST", "/api/erp/auth/device/activate", { cookie: devCookie, body: { code: wrong } })).status);
check("Wrong code: 401 ×4 then locked (423)", codes.join(",") === "401,401,401,401,423", codes.join(","));
r = await call("POST", "/api/erp/auth/device/activate", { cookie: devCookie, body: { code: code1 } });
check("Even the right code is refused once locked (409/423)", r.status === 423 || r.status === 409, `status ${r.status}`);
r = await call("POST", `/api/erp/mobile-devices/${deviceId}/approve`, { ua: UA_WEB, cookie: admin, body: {} });
const code2 = r.json?.data?.code;
check("Super Admin issues a new code", /^\d{6}$/.test(code2 ?? ""));
r = await call("POST", "/api/erp/auth/device/activate", { cookie: devCookie, body: { code: code2 } });
check("Correct code activates the device", r.status === 200 && r.json?.data?.status === "active", JSON.stringify(r.json));

// 6. activated device: login screen opens; sign-in is tied to the approved account
r = await call("GET", "/auth/login", { cookie: devCookie });
check("Active device: login screen opens (no redirect)", r.status === 200 && !toDevice(r), JSON.stringify({ s: r.status, l: r.loc }));
r = await call("POST", "/api/erp/auth/login", { cookie: devCookie, body: { identifier: "someone.else@example.com", password: "x" } });
check("Active device, DIFFERENT account → 403 (device is for another user)", r.status === 403 && r.json?.error?.code === "DEVICE_NOT_ACTIVATED", JSON.stringify(r.json)?.slice(0, 100));
r = await call("POST", "/api/erp/auth/login", { ua: UA_BS, cookie: devCookie, body: { identifier: IDENT, password: "x" } });
check("Device approved for app B cannot sign in through app BS (403)", r.status === 403, `status ${r.status}`);

// 7. per-request enforcement
r = await call("GET", "/api/erp/tracking/summary?domain=both", { cookie: devCookie + "; " + userSession });
check("Active device + the right ERP user → data served", r.status === 200 && r.json?.ok === true, `status ${r.status} ${r.loc}`);
const bound = (await sql`select bound_user_id from mobile_devices where id = ${deviceId}::uuid`)[0]?.bound_user_id;
check("The device is now bound to that user", bound === USER1, String(bound));
r = await call("GET", "/api/erp/tracking/summary?domain=both", { cookie: devCookie + "; " + otherUser });
check("Active device + a DIFFERENT ERP user → no data", !r.json?.ok, `status ${r.status}`);
r = await call("GET", "/api/erp/tracking/summary?domain=both", { ua: UA_BS, cookie: devCookie + "; " + userSession });
check("Device used from the other app (BS) → no data", !r.json?.ok, `status ${r.status}`);
r = await call("GET", "/api/erp/tracking/summary?domain=both", { ua: UA_WEB, cookie: userSession });
check("Plain browser with the same ERP login is unchanged (data served)", r.status === 200 && r.json?.ok === true, `status ${r.status}`);

// 8. revoke ends access on the very next request
r = await call("POST", `/api/erp/mobile-devices/${deviceId}/revoke`, { ua: UA_WEB, cookie: admin, body: { note: "lost phone" } });
check("Super Admin blocks the device", r.status === 200, `status ${r.status}`);
await new Promise((res) => setTimeout(res, 9000)); // the per-process status cache is 8 s
r = await call("GET", "/api/erp/tracking/summary?domain=both", { cookie: devCookie + "; " + userSession });
check("Blocked device: the same ERP session now gets no data", !r.json?.ok, `status ${r.status}`);
r = await call("GET", "/api/erp/auth/device/status", { cookie: devCookie });
check("Blocked device: status = revoked", r.json?.data?.status === "revoked");
r = await call("POST", `/api/erp/mobile-devices/${deviceId}/approve`, { ua: UA_WEB, cookie: admin, body: {} });
check("A blocked device cannot simply be re-approved (409)", r.status === 409, `status ${r.status}`);
const ev = await sql`select event from mobile_device_events where device_id = ${deviceId}::uuid`;
const evs = new Set(ev.map((e) => e.event));
check("Audit trail recorded requested / approved / code_failed / code_locked / activated / revoked", ["requested", "approved", "code_failed", "code_locked", "activated", "revoked"].every((e) => evs.has(e)), [...evs].join(","));

// cleanup (DEV test rows only)
await sql`delete from mobile_devices where id = ${deviceId}::uuid`;
await sql.end();
const bad = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - bad} PASS / ${bad} FAIL ====`);
process.exit(bad ? 1 : 0);
