/**
 * DEV only — Purchase transport payments (/api/erp/purchases/transport-payments): overpayment refused, simultaneous payments serialised,
 * a caller outside the record's country scope is refused (403). Restores the loading record's payload afterwards.
 *   BASE=http://localhost:3520 node scripts/dev/transport-payment-e2e.mjs
 */
import fs from "node:fs";
import postgres from "postgres";
const BASE = process.env.BASE || "http://localhost:3520"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || url.includes("inmayhrxucimxqhgseqi") || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 2, prepare: false, onnotice: () => {} });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 220) : ""); };
const session = async (body) => {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
};
const cookie = await session({ role: "super_admin" });
const call = async (ck, method, body) => {
  const x = await fetch(BASE + "/api/erp/purchases/transport-payments", { method, headers: { cookie: ck, "content-type": "application/json" }, body: JSON.stringify(body) });
  let j = null; try { j = await x.json(); } catch {}
  return { status: x.status, j, msg: j?.error?.message || "" };
};
const [rec] = await sql`select id, country_id, report_payload from purchase_loading_records where deleted_at is null and country_id is not null order by created_at desc limit 1`;
if (!rec) throw new Error("no DEV loading record with a country");
const original = rec.report_payload;
const reset = async (charges) => {
  const payload = { ...(typeof original === "string" ? JSON.parse(original || "{}") : original || {}), transportCharges: charges, transportCurrency: "USD", transportPayments: [], transportPaid: 0, transportBalance: charges };
  await sql`update purchase_loading_records set report_payload = ${sql.json(payload)} where id = ${rec.id}`;
};
const paid = async () => { const [r] = await sql`select report_payload p from purchase_loading_records where id = ${rec.id}`; const p = typeof r.p === "string" ? JSON.parse(r.p) : r.p; return (p.transportPayments || []).reduce((s, x) => s + Number(x.amount || 0), 0); };
const pay = (ck, amount) => call(ck, "POST", { loadingRecordId: rec.id, amount, currency: "USD", exchangeRate: 1, paymentMethod: "Bank Transfer" });
try {
  await reset(1000);
  const a = await pay(cookie, 600);
  check("a payment within the charges posts", a.status === 201 || a.status === 200, `${a.status} ${a.msg}`);
  const b = await pay(cookie, 600);
  check("a payment that would exceed the charges is refused (409)", b.status === 409 && (await paid()) === 600, `${b.status} ${b.msg}`);
  await reset(1000);
  const res = await Promise.all([pay(cookie, 400), pay(cookie, 400), pay(cookie, 400), pay(cookie, 400)]);
  const ok = res.filter((r) => r.status < 300).length;
  console.log("INFO race:", res.map((r) => r.status).join(" "), "paid:", await paid());
  check("four simultaneous 400 payments against 1,000: at most two post and the total never exceeds 1,000", ok >= 1 && ok <= 2 && (await paid()) === 400 * ok && (await paid()) <= 1000, `ok=${ok} paid=${await paid()}`);
  check("none of them is a 500", res.every((r) => r.status < 500), res.map((r) => r.status).join(","));
  // scope: a country admin of a DIFFERENT country must be refused
  const [other] = await sql`select id from countries where deleted_at is null and id <> ${rec.country_id} order by name limit 1`;
  const scoped = await session({ role: "country_admin", countryId: other.id });
  const denied = scoped ? await pay(scoped, 10) : { status: 0 };
  check("a country admin of another country is refused (403)", denied.status === 403, `${denied.status} ${denied.msg}`);
  check("...and nothing was recorded for it", (await paid()) === 400 * ok, String(await paid()));
} catch (e) { fail++; console.log("FATAL", e?.stack || e); }
finally {
  await sql`update purchase_loading_records set report_payload = ${sql.json(typeof original === "string" ? JSON.parse(original || "{}") : original || {})} where id = ${rec.id}`.catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end({ timeout: 5 });
  process.exit(fail ? 1 : 0);
}
