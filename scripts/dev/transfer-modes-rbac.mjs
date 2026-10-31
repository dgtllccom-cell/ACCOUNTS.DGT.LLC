/**
 * DEV only - who may read / add / edit / delete a Transfer Mode (the master behind Transfer Details in Roznamcha cash entry).
 *   BASE=http://localhost:3555 node scripts/dev/transfer-modes-rbac.mjs
 */
import postgres from "postgres";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3555";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || !url.includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not the DEV database");
const sql = postgres(url, { max: 1, prepare: false });
const [c] = await sql`select id::text id from countries where deleted_at is null order by created_at limit 1`;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + detail : ""); };
async function session(role) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, countryId: c.id }) });
  const ck = r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  return ck;
}
const call = (ck) => async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { cookie: ck, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j };
};
const name = "E2E Mode " + Date.now().toString().slice(-6);
const sa = call(await session("super_admin"));
const created = await sa("POST", "/api/erp/transfer-modes", { name, referenceLabel: "Ref", referencePlaceholder: "ref" });
const id = created.j?.data?.data?.id || created.j?.data?.id;
check("super admin can add a mode", created.status === 201 && !!id, `${created.status}`);
check("super admin can list modes", (await sa("GET", "/api/erp/transfer-modes")).status === 200);
check("super admin can edit it", (await sa("PUT", `/api/erp/transfer-modes/${id}`, { name, referenceLabel: "Ref 2", referencePlaceholder: "ref", isActive: true })).status === 200);

for (const role of ["accountant", "cashier", "auditor_viewer", "staff_user", "agent_user"]) {
  const ck = await session(role);
  if (!ck) { console.log("SKIP", role, "(cannot mint)"); continue; }
  const u = call(ck);
  const list = await u("GET", "/api/erp/transfer-modes");
  const add = await u("POST", "/api/erp/transfer-modes", { name: name + " " + role, referenceLabel: "x", referencePlaceholder: "x" });
  const upd = await u("PUT", `/api/erp/transfer-modes/${id}`, { name, referenceLabel: "HACKED", referencePlaceholder: "x", isActive: false });
  const del = await u("DELETE", `/api/erp/transfer-modes/${id}`);
  console.log(`  ${role.padEnd(15)} list ${list.status} · add ${add.status} · edit ${upd.status} · delete ${del.status}`);
  check(`${role}: cannot edit or delete the master`, upd.status === 403 && del.status === 403, `${upd.status}/${del.status}`);
  // a user who may add must not be able to overwrite an existing mode through the add call
  const dup = await u("POST", "/api/erp/transfer-modes", { name, referenceLabel: "HACKED VIA ADD", referencePlaceholder: "x", isActive: false });
  const still = await sa("GET", "/api/erp/transfer-modes?includeInactive=true&search=" + encodeURIComponent(name.toLowerCase()));
  const row = (still.j?.data?.modes || still.j?.data?.data || []).find((m) => m.id === id);
  check(`${role}: adding an existing name does not rewrite it`, !row || (row.reference_label !== "HACKED VIA ADD" && row.is_active !== false), `${dup.status} ${row?.reference_label}`);
  if (add.status === 201) {
    const nid = add.j?.data?.data?.id || add.j?.data?.id;
    if (nid) await sa("DELETE", `/api/erp/transfer-modes/${nid}`);
  }
}
const anon = await fetch(BASE + "/api/erp/transfer-modes");
check("signed out: refused", anon.status === 401 || anon.status === 403, String(anon.status));
await sa("DELETE", `/api/erp/transfer-modes/${id}`);
await sql.end();
const bad = results.filter((x) => !x).length;
console.log(`\n${results.length - bad} PASS / ${bad} FAIL`);
process.exit(bad ? 1 : 0);
