/**
 * Shared helpers for the DEV-only RBAC / domain-separation harnesses.
 * Sessions come from POST /api/erp/auth/dev-session (synthetic identity, NO password, NO real userId).
 * Refuses to run against anything but localhost.
 */
export const BASE = process.env.BASE || "http://127.0.0.1:3540";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only: BASE must be localhost");

// DEV database ids (csesvyxxjivnkkozgopt)
export const IDS = {
  PK: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14",
  UAE: "935dd0b9-8228-43b3-b53d-c06e9ae2882f",
  PK_MAIN: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa",
  UAE_MAIN: "87c2e253-b6c1-482d-a808-272337f3ffda",
  QUETTA: "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b",           // Pakistan - Business
  CHAMAN_SHIP: "ccb85723-e596-4ae8-8bc1-b10f60703197",       // Pakistan - Shipping & Clearing
  DEIRA: "b5e94645-05c1-4420-8ecb-141ca7d84f12",             // UAE - Business (Al Ras Deira)
  ALRAS_SHIP: "301ee7c7-c0c6-401d-a4ee-f140462758f0",        // UAE - Shipping & Clearing
};

export const PERSONAS = {
  global_super: { label: "Global Super Admin", body: { role: "super_admin" } },
  biz_super: { label: "Business Super Admin", body: { role: "super_admin", operationalDomain: "business" } },
  ship_super: { label: "Shipping Super Admin", body: { role: "super_admin", operationalDomain: "shipping" } },
  pk_country_biz: { label: "Pakistan Country Admin (business)", body: { role: "country_admin", countryId: IDS.PK, operationalDomain: "business" } },
  pk_country_ship: { label: "Pakistan Country Admin (shipping)", body: { role: "country_admin", countryId: IDS.PK, operationalDomain: "shipping" } },
  quetta_biz: { label: "Quetta Branch Admin (business)", body: { role: "city_branch_admin", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA, operationalDomain: "business" } },
  chaman_ship: { label: "Chaman Shipping Branch Admin", body: { role: "city_branch_admin", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP, operationalDomain: "shipping", ledgerVisibility: "scoped" } },
  alras_ship: { label: "Al Ras Shipping Branch Admin", body: { role: "city_branch_admin", countryId: IDS.UAE, countryBranchId: IDS.UAE_MAIN, cityBranchId: IDS.ALRAS_SHIP, operationalDomain: "shipping" } },
  deira_biz: { label: "Deira Branch Admin (business)", body: { role: "city_branch_admin", countryId: IDS.UAE, countryBranchId: IDS.UAE_MAIN, cityBranchId: IDS.DEIRA, operationalDomain: "business" } },
};

export async function login(body) {
  const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const cookie = (r.headers.getSetCookie?.() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session="));
  if (!cookie) throw new Error("dev-session failed " + r.status);
  return cookie;
}

export function client(cookie) {
  return {
    cookie,
    async req(method, path, body) {
      const r = await fetch(BASE + path, { method, redirect: "manual", headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, text, location: r.headers.get("location") };
    },
    get(path) { return this.req("GET", path); },
  };
}

/** Pull the first array found in a response under the given keys (APIs wrap rows differently). */
export function rows(json, ...keys) {
  if (!json) return [];
  const d = json.data ?? json;
  for (const k of keys) { if (Array.isArray(d?.[k])) return d[k]; if (Array.isArray(json?.[k])) return json[k]; }
  if (Array.isArray(d)) return d;
  return [];
}

export function tally() {
  const r = { pass: 0, fail: 0, lines: [] };
  r.check = (name, ok, detail = "") => { ok ? r.pass++ : r.fail++; r.lines.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); console.log(r.lines.at(-1)); };
  r.summary = () => { console.log(`\n${r.pass} PASS / ${r.fail} FAIL`); return r.fail === 0; };
  return r;
}
