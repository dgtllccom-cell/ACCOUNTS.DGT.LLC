/**
 * DGT.llc B / DGT.llc BS — app-channel end-to-end check (DEV ONLY).
 * Drives a DEV server (ALLOW_DEV_SESSION=true, port from BASE) with the exact User-Agent tags the store apps send, and checks
 * where each kind of login is sent. The channel is only a front door; permissions are enforced separately (see lib/mobile/app-channel.ts).
 *   BASE=http://localhost:3260 node scripts/e2e-app-channel.mjs
 */
const BASE = process.env.BASE || "http://localhost:3260";
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error("DEV only"); process.exit(2); }
const UA_B = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-B/1";
const UA_BS = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 DGTllc-BS/1";
const UA_WEB = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const COUNTRY = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`); };

async function session(body) {
  const r = await fetch(`${BASE}/api/erp/auth/dev-session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("dev-session failed " + r.status);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}
const get = async (cookie, ua, path) => {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual", headers: { cookie, "user-agent": ua } });
  return { status: r.status, loc: r.headers.get("location") || "" };
};

const superAdmin = await session({ role: "super_admin" });
const bizAdmin = await session({ role: "country_admin", countryId: COUNTRY, operationalDomain: "business", userId: "00000000-0000-4000-8000-000000000001" });
const shipUser = await session({ role: "agent_user", countryId: COUNTRY, operationalDomain: "shipping", userId: "00000000-0000-4000-8000-000000000001" });
const bothUser = await session({ role: "country_admin", countryId: COUNTRY, operationalDomain: "both", userId: "00000000-0000-4000-8000-000000000001" });

let r = await get(superAdmin, UA_BS, "/dashboard");
check("Shipping app: Super Admin /dashboard → shipping home", /\/dashboard\/shipping-line/.test(r.loc), JSON.stringify(r));
r = await get(superAdmin, UA_B, "/dashboard");
check("Business app: Super Admin /dashboard → normal dashboard", /\/dashboard\/super-admin/.test(r.loc), JSON.stringify(r));
r = await get(superAdmin, UA_WEB, "/dashboard");
check("Plain browser (no app tag): Super Admin unchanged", /\/dashboard\/super-admin/.test(r.loc), JSON.stringify(r));

r = await get(bizAdmin, UA_BS, "/dashboard/city");
check("Shipping app: business-only login is sent to the 'wrong app' page", /\/auth\/app-access\?app=bs/.test(r.loc), JSON.stringify(r));
r = await get(bizAdmin, UA_B, "/dashboard/city");
check("Business app: business login is NOT sent to the wrong-app page", !/app-access/.test(r.loc), JSON.stringify(r));

r = await get(shipUser, UA_B, "/dashboard/logistics");
check("Business app: shipping-only login is sent to the 'wrong app' page", /\/auth\/app-access\?app=b/.test(r.loc), JSON.stringify(r));
r = await get(shipUser, UA_BS, "/dashboard/logistics");
check("Shipping app: shipping login is NOT sent to the wrong-app page", !/app-access/.test(r.loc), JSON.stringify(r));
r = await get(shipUser, UA_BS, "/dashboard");
check("Shipping app: shipping login lands on a shipping-side dashboard", /logistics|shipping-line|clearing-agent|agent/.test(r.loc), JSON.stringify(r));

r = await get(bothUser, UA_B, "/dashboard/city");
check("Business app: 'both' login allowed", !/app-access/.test(r.loc), JSON.stringify(r));
r = await get(bothUser, UA_BS, "/dashboard/city");
check("Shipping app: 'both' login allowed", !/app-access/.test(r.loc), JSON.stringify(r));

r = await fetch(`${BASE}/auth/app-access?app=bs`, { headers: { "user-agent": UA_BS } });
const html = await r.text();
check("Wrong-app page renders without a session (200, names the right app)", r.status === 200 && html.includes("DGT.llc B"), `status ${r.status}`);
r = await fetch(`${BASE}/legal/privacy`, { redirect: "manual" });
check("Privacy policy page is public (200)", r.status === 200, `status ${r.status} ${r.headers.get("location") || ""}`);

const bad = results.filter((x) => !x).length;
console.log(`\n==== ${results.length - bad} PASS / ${bad} FAIL ====`);
process.exit(bad ? 1 : 0);
