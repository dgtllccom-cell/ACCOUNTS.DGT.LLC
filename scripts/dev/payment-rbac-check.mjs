/**
 * DEV-only RBAC check of the read-only payment-list APIs behind the ten payment pages' headers.
 *   BASE=http://localhost:3300 node scripts/dev/payment-rbac-check.mjs
 * Compares row counts / countries returned to Super Admin, Country Admin (Pakistan, UAE) and a city-branch user.
 */
const BASE = process.env.BASE || "http://localhost:3300";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const cases = [
  { label: "super_admin", body: { role: "super_admin" } },
  { label: "country_admin Pakistan", body: { role: "country_admin", countryId: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14" } },
  { label: "country_admin UAE", body: { role: "country_admin", countryId: "935dd0b9-8228-43b3-b53d-c06e9ae2882f" } },
  { label: "branch Pakistan Main", body: { role: "branch_admin", countryId: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", countryBranchId: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa" } },
  { label: "city branch Chaman", body: { role: "branch_admin", countryId: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", countryBranchId: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", cityBranchId: "322351af-732f-4351-a89b-ba34cfe598cf" } },
];
for (const c of cases) {
  if (process.env.ONLY && !c.label.includes(process.env.ONLY)) continue;
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c.body) });
  const cookie = (r.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!cookie) { console.log(c.label.padEnd(26), "dev-session failed", r.status); continue; }
  const get = async (u) => { const x = await fetch(BASE + u, { headers: { cookie } }); const j = await x.json().catch(() => ({})); return { status: x.status, j }; };
  const [pp, sp, po, so] = await Promise.all([
    get("/api/erp/purchases/payments?limit=500"), get("/api/erp/sales/payments?limit=500"),
    get("/api/erp/purchases/orders?limit=500"), get("/api/erp/sales/orders?limit=500"),
  ]);
  const n = (x, k) => (x.j?.data?.[k] ?? []).length;
  const countries = (x, k, f) => [...new Set((x.j?.data?.[k] ?? []).map(f))].join(",") || "-";
  console.log(c.label.padEnd(26), `purchase-payments ${pp.status}/${n(pp, "payments")}`, `sales-payments ${sp.status}/${n(sp, "payments")}`, `purchase-orders ${po.status}/${n(po, "orders")}`, `sales-orders ${so.status}/${n(so, "orders")}`, "| sales-payment countries:", countries(sp, "payments", (p) => String(p.country_id ?? "").slice(0, 8)));
}
