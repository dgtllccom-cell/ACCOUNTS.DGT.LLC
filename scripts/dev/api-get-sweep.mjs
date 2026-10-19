/** DEV only — calls every parameter-less GET API route as a DEV super admin and lists the ones that answer 5xx. BASE=http://localhost:3520 node scripts/dev/api-get-sweep.mjs */
import fs from "node:fs"; import path from "node:path";
const BASE = process.env.BASE || "http://localhost:3520"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const root = "app/api"; const routes = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "route.ts") { const src = fs.readFileSync(p, "utf8"); if (/export\s+(async\s+)?function\s+GET|export\s+const\s+GET/.test(src)) routes.push(p); } } })(root);
const SKIP = /auth\/(logout|dev-session|login)|\/export|download|cron|webhook|stream|events$/;
const urls = routes.map((p) => "/" + path.relative("app", path.dirname(p)).split(path.sep).join("/")).filter((u) => !u.includes("[") && !SKIP.test(u));
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="));
let i = 0; const bad = []; const codes = {};
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    try {
      const x = await fetch(BASE + u, { headers: { cookie }, signal: AbortSignal.timeout(60000) });
      codes[x.status] = (codes[x.status] || 0) + 1;
      if (x.status >= 500) { let m = ""; try { m = (await x.json())?.error?.message || ""; } catch {} bad.push(`${x.status} ${u} ${m.slice(0, 120)}`); }
    } catch (e) { bad.push(`ERR ${u} ${String(e).slice(0, 60)}`); }
  }
}
await Promise.all([1, 2, 3, 4].map(worker));
console.log(`routes swept: ${urls.length}`, JSON.stringify(codes)); console.log(bad.sort().join("\n") || "no 5xx");
