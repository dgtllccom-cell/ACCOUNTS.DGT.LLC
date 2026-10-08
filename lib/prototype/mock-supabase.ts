import { isPrototypeMode } from "@/lib/prototype/mode";

const IDS = {
  uae: "00000000-0000-4000-8000-00000000ae01",
  pakistan: "00000000-0000-4000-8000-00000000pk01",
  uaeMain: "00000000-0000-4000-8000-00000000ae10",
  pkMain: "00000000-0000-4000-8000-00000000pk10",
  alRas: "00000000-0000-4000-8000-00000000ae11",
  quetta: "00000000-0000-4000-8000-00000000pk11",
  chaman: "00000000-0000-4000-8000-00000000pk12",
};

const DATA: Record<string, any[]> = {
  countries: [
    { id: IDS.uae, iso2: "AE", code: "AE", name: "United Arab Emirates", country_name: "United Arab Emirates", currency_code: "AED", deleted_at: null },
    { id: IDS.pakistan, iso2: "PK", code: "PK", name: "Pakistan", country_name: "Pakistan", currency_code: "PKR", deleted_at: null },
  ],
  country_branches: [
    { id: IDS.uaeMain, country_id: IDS.uae, name: "UAE Main Branch", code: "UAE-MAIN", status: "active", deleted_at: null },
    { id: IDS.pkMain, country_id: IDS.pakistan, name: "Pakistan Main Branch", code: "PK-MAIN", status: "active", deleted_at: null },
  ],
  city_branches: [
    { id: IDS.alRas, country_id: IDS.uae, country_branch_id: IDS.uaeMain, name: "Al Ras Business Branch", city_name: "Dubai", operational_domain: "business", status: "active", deleted_at: null },
    { id: IDS.quetta, country_id: IDS.pakistan, country_branch_id: IDS.pkMain, name: "Quetta Business Branch", city_name: "Quetta", operational_domain: "business", status: "active", deleted_at: null },
    { id: IDS.chaman, country_id: IDS.pakistan, country_branch_id: IDS.pkMain, name: "Chaman Shipping Line Branch", city_name: "Chaman", operational_domain: "shipping", status: "active", deleted_at: null },
  ],
  companies: [
    { id: "00000000-0000-4000-8000-000000000201", name: "Daman General Trading LLC", company_name: "Daman General Trading LLC", country_id: IDS.uae, city_branch_id: IDS.alRas, is_active: true, deleted_at: null },
  ],
  goods: [
    { id: "00000000-0000-4000-8000-000000000301", goods_name: "Almond Kernel", name: "Almond Kernel", hs_code: "080212", deleted_at: null,
      variations: [{ id: "00000000-0000-4000-8000-000000000311", size: "23/25", brand: "DGT", variety: "Premium" }] },
    { id: "00000000-0000-4000-8000-000000000302", goods_name: "Pistachio Kernel", name: "Pistachio Kernel", hs_code: "080252", deleted_at: null,
      variations: [{ id: "00000000-0000-4000-8000-000000000312", size: "Whole", brand: "DGT", variety: "Premium" }] },
  ],
  goods_variations: [
    { id: "00000000-0000-4000-8000-000000000311", goods_id: "00000000-0000-4000-8000-000000000301", size: "23/25", brand: "DGT", variety: "Premium" },
    { id: "00000000-0000-4000-8000-000000000312", goods_id: "00000000-0000-4000-8000-000000000302", size: "Whole", brand: "DGT", variety: "Premium" },
  ],
  customers: [
    { id: "00000000-0000-4000-8000-000000000401", name: "Prototype Customer", company_name: "Prototype Customer", country_id: IDS.uae, city_branch_id: IDS.alRas, status: "active", deleted_at: null },
  ],
  warehouses: [
    { id: "00000000-0000-4000-8000-000000000501", name: "Al Ras Warehouse", country_id: IDS.uae, city_branch_id: IDS.alRas, is_active: true, deleted_at: null },
  ],
  banks: [
    { id: "00000000-0000-4000-8000-000000000601", name: "Prototype Bank", bank_name: "Prototype Bank", country_id: IDS.uae, is_active: true, deleted_at: null },
  ],
  shipping_lines: [
    { id: "00000000-0000-4000-8000-000000000701", name: "Prototype Shipping Line", code: "PSL", status: "active", deleted_at: null },
  ],
  clearing_agents: [
    { id: "00000000-0000-4000-8000-000000000801", name: "Prototype Clearing Agent", country_id: IDS.pakistan, status: "active", deleted_at: null },
  ],
  profiles: [
    { id: "00000000-0000-4000-8000-000000000001", full_name: "DGT ERP Prototype", preferred_language_code: "en", deleted_at: null, must_change_password: false },
  ],
  user_role_assignments: [
    { id: "00000000-0000-4000-8000-000000000901", user_id: "00000000-0000-4000-8000-000000000001", role: "super_admin", operational_domain: "both", mobile_profile: "standard", deleted_at: null },
  ],
  branch_rules: [],
};

function applyFilters(rows: any[], filters: Array<{ type: string; column: string; value: any }>) {
  return rows.filter((row) => filters.every((f) => {
    const value = row?.[f.column];
    if (f.type === "eq") return value === f.value;
    if (f.type === "neq") return value !== f.value;
    if (f.type === "is") return value === f.value;
    if (f.type === "in") return Array.isArray(f.value) ? f.value.includes(value) : true;
    return true;
  }));
}

function builderFor(table: string) {
  const state = {
    table,
    filters: [] as Array<{ type: string; column: string; value: any }>,
    orderBy: null as null | { column: string; ascending: boolean },
    limit: null as null | number,
    writePayload: undefined as any,
  };

  const result = () => {
    let rows = [...(DATA[state.table] ?? [])];
    rows = applyFilters(rows, state.filters);
    if (state.orderBy) {
      const { column, ascending } = state.orderBy;
      rows.sort((a, b) => String(a?.[column] ?? "").localeCompare(String(b?.[column] ?? "")) * (ascending ? 1 : -1));
    }
    if (typeof state.limit === "number") rows = rows.slice(0, state.limit);
    return { data: rows, error: null, count: rows.length };
  };

  const api: any = {
    select() { return api; },
    eq(column: string, value: any) { state.filters.push({ type: "eq", column, value }); return api; },
    neq(column: string, value: any) { state.filters.push({ type: "neq", column, value }); return api; },
    is(column: string, value: any) { state.filters.push({ type: "is", column, value }); return api; },
    in(column: string, value: any[]) { state.filters.push({ type: "in", column, value }); return api; },
    not() { return api; },
    or() { return api; },
    match() { return api; },
    contains() { return api; },
    overlap() { return api; },
    filter() { return api; },
    like() { return api; },
    ilike() { return api; },
    gt() { return api; },
    gte() { return api; },
    lt() { return api; },
    lte() { return api; },
    range() { return api; },
    order(column: string, opts?: { ascending?: boolean }) { state.orderBy = { column, ascending: opts?.ascending !== false }; return api; },
    limit(value: number) { state.limit = value; return api; },
    insert(payload: any) { state.writePayload = payload; return api; },
    upsert(payload: any) { state.writePayload = payload; return api; },
    update(payload: any) { state.writePayload = payload; return api; },
    delete() { state.writePayload = null; return api; },
    async single() {
      const r = result();
      const row = Array.isArray(state.writePayload) ? state.writePayload[0] : state.writePayload ?? r.data[0] ?? null;
      return { data: row, error: null };
    },
    async maybeSingle() {
      const r = result();
      const row = Array.isArray(state.writePayload) ? state.writePayload[0] : state.writePayload ?? r.data[0] ?? null;
      return { data: row, error: null };
    },
    then(resolve: any, reject: any) {
      return Promise.resolve(result()).then(resolve, reject);
    },
  };
  return api;
}

export function createPrototypeSupabaseClient(): any {
  if (!isPrototypeMode()) throw new Error("Prototype Supabase client requested outside prototype mode");
  const prototypeUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "prototype@dgt.local",
    user_metadata: { full_name: "DGT ERP Prototype" },
  };
  return {
    from(table: string) { return builderFor(table); },
    rpc() { return builderFor("__rpc__"); },
    auth: {
      async getUser() { return { data: { user: prototypeUser }, error: null }; },
      async getSession() { return { data: { session: { user: prototypeUser } }, error: null }; },
      async signOut() { return { error: null }; },
      admin: {
        async listUsers() { return { data: { users: [prototypeUser] }, error: null }; },
        async getUserById() { return { data: { user: prototypeUser }, error: null }; },
        async updateUserById() { return { data: { user: prototypeUser }, error: null }; },
      },
    },
    storage: {
      from() {
        return {
          async list() { return { data: [], error: null }; },
          async upload() { return { data: { path: "prototype/no-write" }, error: null }; },
          async download() { return { data: new Blob([]), error: null }; },
          getPublicUrl() { return { data: { publicUrl: "" } }; },
          async remove() { return { data: [], error: null }; },
        };
      },
    },
    functions: {
      async invoke() { return { data: {}, error: null }; },
    },
  };
}
