// DEV only: which purchase-payment records does each scope see? (BASE=http://localhost:3300)
const BASE = process.env.BASE || "http://localhost:3300";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", MAIN = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", CHAMAN = "322351af-732f-4351-a89b-ba34cfe598cf";
const sess = async (body) => { const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")); };
const list = async (cookie) => { const r = await fetch(BASE + "/api/erp/purchases/payments?limit=500", { headers: { cookie } }); const j = await r.json(); return j.data?.payments ?? []; };
const sets = {};
for (const [k, b] of Object.entries({ country: { role: "country_admin", countryId: PK }, branch: { role: "branch_admin", countryId: PK, countryBranchId: MAIN }, city: { role: "branch_admin", countryId: PK, countryBranchId: MAIN, cityBranchId: CHAMAN } })) {
  const rows = await list(await sess(b)); sets[k] = new Map(rows.map((p) => [p.id, p]));
  console.log(k, rows.length);
}
const extra = [...sets.city.values()].filter((p) => !sets.country.has(p.id));
console.log("in city but NOT in country:", extra.length);
for (const p of extra.slice(0, 8)) console.log(" ", p.id?.slice(0, 8), p.purchase_order_no, p.status, p.kind, p.currency_code, p.amount, JSON.stringify({ c: p.country_id, cb: p.country_branch_id, city: p.city_branch_id }));
