/**
 * DEV only: server-side scope enforcement of the Cash Journal endpoints (tables, totals, account selectors, export, reports).
 *   BASE=http://localhost:3300 node scripts/dev/cash-scope-check.mjs
 * For every role it calls each endpoint with its own scope AND with another country's ids (tampering) and prints what came back.
 * PASS = a scoped user never receives rows/totals/accounts of a country or branch outside the session.
 */
const BASE = process.env.BASE || "http://localhost:3300";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const AF = "8366fa0e-dcf6-4acd-8602-2819f103dd63", AFB = "0842bdac-4c33-4b9e-ada5-e21aa8176151";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", PKB = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";
const AE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f", AEB = "87c2e253-b6c1-482d-a808-272337f3ffda";
const QUETTA = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b", CHAMAN_SHIP = "ccb85723-e596-4ae8-8bc1-b10f60703197", DEIRA = "b5e94645-05c1-4420-8ecb-141ca7d84f12";
const NAMES = { [AF]: "AF", [PK]: "PK", [AE]: "AE" };
const roles = [
  { label: "super_admin", body: { role: "super_admin" }, allow: { c: [AF, PK, AE] } },
  { label: "country_admin PK", body: { role: "country_admin", countryId: PK }, allow: { c: [PK] } },
  { label: "country_admin AE", body: { role: "country_admin", countryId: AE }, allow: { c: [AE] } },
  { label: "branch_admin PK main", body: { role: "branch_admin", countryId: PK, countryBranchId: PKB }, allow: { c: [PK], cb: [PKB] } },
  { label: "city user Quetta (business)", body: { role: "branch_admin", countryId: PK, countryBranchId: PKB, cityBranchId: QUETTA }, allow: { c: [PK], city: [QUETTA] } },
  { label: "shipping_line_admin Chaman", body: { role: "shipping_line_admin", operationalDomain: "shipping", countryId: PK, countryBranchId: PKB, cityBranchId: CHAMAN_SHIP }, allow: { c: [PK], city: [CHAMAN_SHIP] } },
  { label: "shipping_line_user Chaman", body: { role: "shipping_line_user", operationalDomain: "shipping", countryId: PK, countryBranchId: PKB, cityBranchId: CHAMAN_SHIP }, allow: { c: [], deny: true } },
];
const tag = (ids) => [...new Set(ids)].map((i) => NAMES[i] || String(i).slice(0, 8)).join(",") || "-";
let fails = 0;
for (const r of roles) {
  if (process.env.ONLY && !r.label.includes(process.env.ONLY)) continue;
  const sres = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.body) });
  const cookie = (sres.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  const get = async (u) => { const x = await fetch(BASE + u, { headers: { cookie } }); const t = await x.text(); let j; try { j = JSON.parse(t); } catch { j = null; } return { status: x.status, j, t }; };
  const out = [];
  const bad = (m) => { fails++; out.push("  ✗ " + m); };
  const ok = (m) => out.push("  ✓ " + m);
  // 1) the table (own scope)
  const own = await get("/api/erp/roznamcha?limit=500");
  const ents = own.j?.data?.entries ?? [];
  const cs = ents.map((e) => e.country_id), cbs = ents.map((e) => e.country_branch_id), cities = ents.map((e) => e.city_branch_id);
  const outC = r.label === "super_admin" ? [] : cs.filter((c) => !r.allow.c.includes(c));
  const outCB = r.allow.cb ? cbs.filter((c) => !r.allow.cb.includes(c)) : [];
  const outCity = r.allow.city ? cities.filter((c) => !r.allow.city.includes(c)) : [];
  if (r.allow.deny) (ents.length === 0 ? ok(`table denied/empty (status ${own.status})`) : bad(`table returned ${ents.length} rows`));
  else if (outC.length || outCB.length || outCity.length) bad(`table leaked: countries ${tag(outC)} branches ${outCB.length} cities ${outCity.length}`);
  else ok(`table ${ents.length} rows, countries [${tag(cs)}], city branches [${tag(cities)}]`);
  // 2) tampering: another country's ids in the query string
  for (const [label, q] of [["AF", `countryId=${AF}&countryBranchId=${AFB}`], ["AE", `countryId=${AE}&countryBranchId=${AEB}`], ["Deira city", `countryId=${AE}&countryBranchId=${AEB}&cityBranchId=${DEIRA}`]]) {
    if (r.allow.c.includes(q.includes(AF) ? AF : AE) && !q.includes("cityBranchId")) continue;
    const t = await get(`/api/erp/roznamcha?limit=500&${q}`);
    const tr = t.j?.data?.entries ?? [];
    const leaked = tr.filter((e) => !r.allow.c.includes(e.country_id) || (r.allow.city && !r.allow.city.includes(e.city_branch_id)) || (r.allow.cb && !r.allow.cb.includes(e.country_branch_id)));
    leaked.length ? bad(`tamper ${label}: ${leaked.length} foreign rows returned`) : ok(`tamper ${label}: ${tr.length} rows (status ${t.status})`);
  }
  // 3) totals
  const ov = await get(`/api/erp/roznamcha/summary-overview?date=2026-10-10`);
  const ovC = (ov.j?.countries ?? ov.j?.data?.countries ?? []).filter((c) => (c.entryCount ?? 0) > 0 || (c.totalCredit ?? 0) > 0 || (c.totalDebit ?? 0) > 0).map((c) => c.countryId);
  const ovOut = ovC.filter((c) => !r.allow.c.includes(c));
  r.allow.deny ? (ov.status >= 400 || !ovC.length ? ok(`overview denied/empty (${ov.status})`) : bad("overview returned data")) : ovOut.length ? bad(`overview totals for foreign countries ${tag(ovOut)}`) : ok(`overview totals for [${tag(ovC)}]`);
  for (const [label, cid] of [["AF", AF], ["AE", AE]]) {
    if (r.allow.c.includes(cid)) continue;
    const t = await get(`/api/erp/roznamcha/cash-summary?countryId=${cid}&date=2026-10-10`);
    const tot = Number(t.j?.data?.totalCredit ?? 0) + Number(t.j?.data?.totalDebit ?? 0) + Number(t.j?.data?.entryCount ?? 0);
    (t.status >= 400 || tot === 0) ? ok(`cash-summary ${label}: status ${t.status}, no foreign totals`) : bad(`cash-summary ${label} returned totals ${tot}`);
  }
  // 4) account selector (ledgers)
  const lg = await get(`/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=3000&language=en`);
  const lrows = lg.j?.data?.ledgers ?? lg.j?.data?.rows ?? lg.j?.data ?? [];
  const lcs = Array.isArray(lrows) ? lrows.map((l) => l.countryId || l.country_id).filter(Boolean) : [];
  const lOut = lcs.filter((c) => !r.allow.c.includes(c));
  if (r.label === "super_admin") ok(`ledger selector: ${Array.isArray(lrows) ? lrows.length : "?"} ledgers (global scope)`);
  else if (lg.status >= 400) ok(`ledger selector super_admin scope refused (${lg.status})`);
  else lOut.length ? bad(`ledger selector leaked ${lOut.length} foreign-country ledgers via reportScope=super_admin`) : ok(`ledger selector: ${lrows.length} ledgers, countries [${tag(lcs)}]`);
  const lg2 = await get(`/api/erp/accounting/reports/ledger/ledgers?reportScope=country&countryId=${r.allow.c[0] === AE ? PK : AE}&limit=3000&language=en`);
  const l2 = lg2.j?.data?.ledgers ?? lg2.j?.data?.rows ?? lg2.j?.data ?? [];
  const l2c = Array.isArray(l2) ? l2.map((l) => l.countryId || l.country_id).filter(Boolean).filter((c) => !r.allow.c.includes(c)) : [];
  r.label === "super_admin" ? ok("ledger selector (other country) allowed for super admin") : l2c.length ? bad(`ledger selector for another country leaked ${l2c.length} ledgers`) : ok(`ledger selector for another country: status ${lg2.status}, 0 foreign ledgers`);
  // 5) export (CSV) — same scoped rows as the table
  const ex = await get(`/api/erp/roznamcha/export?format=csv&fromDate=2020-01-01&toDate=2026-12-31`);
  const lines = ex.t.split(/\r?\n/).filter(Boolean).length;
  const tx = await get(`/api/erp/roznamcha/export?format=csv&fromDate=2020-01-01&toDate=2026-12-31&countryId=${r.allow.c.includes(AE) ? PK : AE}&countryBranchId=${r.allow.c.includes(AE) ? PKB : AEB}`);
  const tlines = tx.t.split(/\r?\n/).filter(Boolean).length;
  if (r.label === "super_admin") ok(`export csv: ${lines} lines (global)`);
  else if (r.allow.deny) (ex.status >= 400 || lines <= 2 ? ok(`export denied/empty (${ex.status}, ${lines} lines)`) : bad(`export returned ${lines} lines`));
  else ok(`export csv: ${lines} lines (status ${ex.status}); tamper export: status ${tx.status}, ${tlines} lines vs own ${lines}${tlines > lines ? "  ✗ MORE than own scope" : ""}`) , tlines > lines && bad("tamper export returned more lines than own scope");
  console.log(`\n${r.label}`); console.log(out.join("\n"));
}
console.log(`\n==== ${fails === 0 ? "ALL SCOPE CHECKS PASS" : fails + " FAILURE(S)"} ====`);
process.exit(fails ? 1 : 0);
