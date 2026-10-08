/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { canAccessCityBranch, canAccessCountry, canAccessCountryBranch, ErpPermissionError } from "@/lib/permissions/middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/branch-management/network-view?type=country|branch&id=<uuid>
 *
 * Backing data for the full-screen Country Operations View and Branch Detail View. Everything is read
 * live from the existing hierarchy tables and counts ONLY live (non-deleted, non-inactive) records — an
 * archived branch is never counted or listed here; it exists only in the audit trail.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUSINESS_MODULES = ["purchase", "sales", "inventory", "customers", "accounts", "ledger", "roznamcha", "expenses", "reports"];
const SHIPPING_MODULES = ["shipping_clearing", "loading", "receiving", "transfers", "consignments", "shipping_line_statements", "reports"];

function normPerms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function branchType(domain: string | null | undefined): "shipping" | "business" | "both" {
  return domain === "shipping" ? "shipping" : domain === "both" ? "both" : "business";
}

async function loadUsers(sql: any, whereSql: any, ids: { countryId?: string | null }) {
  const rows = (await sql`
    select ura.id as assignment_id, ura.user_id, ura.role::text as role, ura.operational_domain, ura.is_active,
           ura.country_id, ura.country_branch_id, ura.city_branch_id, ura.mobile_profile,
           p.full_name, p.user_code, u.email,
           u.raw_user_meta_data->>'username' as username,
           ups.permissions
      from public.user_role_assignments ura
      left join public.profiles p on p.id = ura.user_id
      left join auth.users u on u.id = ura.user_id
      left join public.user_permission_sets ups on ups.user_id = ura.user_id
     where ura.deleted_at is null and ura.is_active = true and ${whereSql}
     order by ura.created_at asc
  `) as any[];
  void ids;
  return rows.map((r) => ({
    assignmentId: r.assignment_id as string,
    userId: r.user_id as string,
    name: (r.full_name as string | null) ?? (r.email as string | null) ?? "—",
    userCode: (r.user_code as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    username: (r.username as string | null) ?? null,
    role: r.role as string,
    domain: (r.operational_domain as string | null) ?? "business",
    status: r.is_active ? "active" : "inactive",
    permissions: normPerms(r.permissions),
    countryBranchId: (r.country_branch_id as string | null) ?? null,
    cityBranchId: (r.city_branch_id as string | null) ?? null
  }));
}

const ADMIN_ROLES = new Set(["country_admin", "main_branch_admin", "city_branch_admin", "branch_admin"]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id") ?? "";
    if (type !== "country" && type !== "branch") throw new ApiClientError("type must be country or branch.", { status: 400 });
    if (!UUID_RE.test(id)) throw new ApiClientError("Record not found.", { status: 404, code: "NOT_FOUND" });

    const result = await withLocalPg(async (sql: any) => {
      if (type === "country") return loadCountry(sql, session, id);
      return loadBranch(sql, session, id);
    });
    if (!result) throw new ApiClientError("Database connection is not available.", { status: 503 });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function loadCountry(sql: any, session: any, id: string) {
  const [country] = (await sql`
    select id, name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, whatsapp_number, phone_code, default_language_code
      from public.countries where id = ${id}::uuid and deleted_at is null limit 1
  `) as any[];
  if (!country) throw new ApiClientError("Country not found.", { status: 404, code: "NOT_FOUND" });
  if (!canAccessCountry(session, id)) throw new ErpPermissionError("This country is outside your authorized scope.");

  const mains = (await sql`
    select id, name, code, status::text as status, operational_domain, local_currency, address, phone, email, whatsapp_number, owner_name, is_main
      from public.country_branches where country_id = ${id}::uuid and deleted_at is null
     order by is_main desc nulls last, created_at asc
  `) as any[];
  const mainIds = mains.map((m) => m.id as string);

  const cityRows = (await sql`
    select cb.id, cb.name, cb.code, cb.city_name, cb.status::text as status, cb.operational_domain, coalesce(cb.is_business_branch, true) as is_business_branch,
           cb.country_branch_id, cb.local_currency,
           (select count(*)::int from public.user_role_assignments a where a.city_branch_id = cb.id and a.is_active = true and a.deleted_at is null) as users,
           (select count(*)::int from public.enterprise_accounts ea where ea.city_branch_id = cb.id and ea.deleted_at is null) as accounts
      from public.city_branches cb
     where cb.country_id = ${id}::uuid and cb.deleted_at is null
     order by cb.city_name asc, cb.created_at asc
  `) as any[];

  const allUsers = await loadUsers(
    sql,
    sql`(ura.country_id = ${id}::uuid or ura.country_branch_id = any(${mainIds}::uuid[]) or ura.city_branch_id = any(${cityRows.map((c) => c.id)}::uuid[]))`,
    {}
  );

  const cityAdmin = new Map<string, { name: string; userId: string }>();
  for (const u of allUsers) {
    if (u.cityBranchId && ADMIN_ROLES.has(u.role) && !cityAdmin.has(u.cityBranchId)) cityAdmin.set(u.cityBranchId, { name: u.name, userId: u.userId });
  }

  // Users assigned directly at country / Country Main Branch level (no city branch).
  const directUsers = allUsers.filter((u) => !u.cityBranchId);
  const countryAdmins = directUsers.filter((u) => u.role === "country_admin");

  const [acc] = (await sql`
    select count(*)::int as n from public.enterprise_accounts ea
     where ea.country_id = ${id}::uuid and ea.deleted_at is null
       and (ea.city_branch_id is null or ea.city_branch_id in (select cb.id from public.city_branches cb where cb.deleted_at is null))
  `) as any[];

  const branches = cityRows.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    code: c.code as string,
    cityName: c.city_name as string,
    countryName: country.name as string,
    type: branchType(c.operational_domain),
    domain: (c.operational_domain as string | null) ?? "business",
    status: c.status as string,
    admin: cityAdmin.get(c.id) ?? null,
    users: c.users as number,
    accounts: c.accounts as number,
    currency: c.local_currency as string | null
  }));

  const activeBranches = branches.filter((b) => b.status === "active");
  const distinctUsers = new Set(allUsers.map((u) => u.userId));

  return {
    kind: "country" as const,
    country: {
      id: country.id as string,
      name: country.name as string,
      code: (country.iso2 as string | null) ?? (country.iso3 as string | null) ?? "",
      currency: country.currency_code as string,
      reportingCurrency: (country.reporting_currency as string | null) ?? null,
      status: country.is_active ? "active" : "inactive",
      email: (country.official_email as string | null) ?? null,
      adminEmail: (country.admin_email as string | null) ?? null,
      whatsapp: (country.whatsapp_number as string | null) ?? null,
      phoneCode: (country.phone_code as string | null) ?? null,
      language: (country.default_language_code as string | null) ?? null
    },
    mainBranches: mains.map((m) => ({
      id: m.id as string,
      name: m.name as string,
      code: m.code as string,
      status: m.status as string,
      domain: (m.operational_domain as string | null) ?? "business",
      currency: m.local_currency as string | null,
      address: m.address as string | null,
      phone: m.phone as string | null,
      email: m.email as string | null,
      whatsapp: m.whatsapp_number as string | null,
      ownerName: m.owner_name as string | null
    })),
    countryAdmins: countryAdmins.map((u) => ({ userId: u.userId, name: u.name, email: u.email, status: u.status })),
    directUsers,
    branches,
    totals: {
      activeBranches: activeBranches.length,
      businessBranches: activeBranches.filter((b) => b.type !== "shipping").length,
      shippingBranches: activeBranches.filter((b) => b.type === "shipping").length,
      users: distinctUsers.size,
      accounts: (acc?.n as number) ?? 0
    }
  };
}

async function loadBranch(sql: any, session: any, id: string) {
  const [cb] = (await sql`
    select cb.*, cb.status::text as status_text, co.name as country_name, co.iso2 as country_code, co.currency_code as country_currency,
           mb.name as main_name, mb.code as main_code, mb.id as main_id
      from public.city_branches cb
      left join public.countries co on co.id = cb.country_id
      left join public.country_branches mb on mb.id = cb.country_branch_id
     where cb.id = ${id}::uuid and cb.deleted_at is null limit 1
  `) as any[];
  // A deleted/archived branch is never shown in the live view.
  if (!cb) throw new ApiClientError("Branch not found or archived.", { status: 404, code: "NOT_FOUND" });
  if (!canAccessCityBranch(session, id) && !canAccessCountryBranch(session, cb.country_branch_id) && !canAccessCountry(session, cb.country_id)) {
    throw new ErpPermissionError("This branch is outside your authorized scope.");
  }
  const domain = (cb.operational_domain as string | null) ?? "business";
  const type = branchType(domain);
  const showMoney = session.isSuperAdmin || session.canViewFinancials !== false;

  const users = await loadUsers(sql, sql`ura.city_branch_id = ${id}::uuid`, {});
  const admin = users.find((u) => ADMIN_ROLES.has(u.role)) ?? null;

  const accounts = (await sql`
    select ea.id, ea.code, ea.name, ea.kind::text as kind, ea.currency, ea.current_balance, ea.status::text as status, ea.operational_domain, ea.account_number
      from public.enterprise_accounts ea
     where ea.city_branch_id = ${id}::uuid and ea.deleted_at is null
     order by ea.code asc limit 200
  `) as any[];
  const [accCount] = (await sql`select count(*)::int as n from public.enterprise_accounts where city_branch_id = ${id}::uuid and deleted_at is null`) as any[];
  const [ledgerCount] = (await sql`select count(*)::int as n from public.ledgers where city_branch_id = ${id}::uuid and deleted_at is null`) as any[];
  const ledgers = (await sql`
    select id, code, name, currency, current_balance, debit_total, credit_total
      from public.ledgers where city_branch_id = ${id}::uuid and deleted_at is null order by code asc limit 100
  `) as any[];

  const companies = (await sql`
    select id, name, company_code, company_type, company_status
      from public.companies where city_branch_id = ${id}::uuid and deleted_at is null order by name asc limit 100
  `) as any[];
  const customers = (await sql`
    select distinct c.id, c.customer_name, c.company_name, c.mobile
      from public.enterprise_accounts ea
      join public.customers c on c.id = ea.customer_id and c.deleted_at is null
     where ea.city_branch_id = ${id}::uuid and ea.deleted_at is null
     order by c.customer_name asc limit 100
  `) as any[];

  const audit = (await sql`
    select al.id, al.action, al.entity_table, al.created_at, coalesce(p.full_name, '—') as actor
      from public.audit_logs al
      left join public.profiles p on p.id = al.actor_id
     where (al.entity_table = 'city_branches' and al.entity_id = ${id}::uuid)
        or (al.entity_table = 'user_role_assignments' and al.after->>'city_branch_id' = ${id})
     order by al.created_at desc limit 40
  `) as any[];

  // Business/Shipping separation proof: anything attached to this branch that belongs to the OTHER domain.
  const otherDomain = type === "shipping" ? "business" : "shipping";
  const separation = {
    domain,
    usersOtherDomain: type === "both" ? 0 : users.filter((u) => u.domain === otherDomain).length,
    accountsOtherDomain: type === "both" ? 0 : accounts.filter((a) => a.operational_domain === otherDomain).length
  };

  return {
    kind: "branch" as const,
    branch: {
      id: cb.id as string,
      name: cb.name as string,
      code: cb.code as string,
      cityName: cb.city_name as string,
      type,
      domain,
      status: cb.status_text as string,
      currency: cb.local_currency as string | null,
      address: cb.address as string | null,
      phone: cb.phone as string | null,
      email: cb.email as string | null,
      whatsapp: cb.whatsapp_number as string | null,
      ownerName: cb.owner_name as string | null,
      createdAt: cb.created_at as string | null,
      brandingName: cb.branding_company_name as string | null
    },
    country: { id: cb.country_id as string, name: cb.country_name as string, code: cb.country_code as string | null, currency: cb.country_currency as string | null },
    mainBranch: cb.main_id ? { id: cb.main_id as string, name: cb.main_name as string, code: cb.main_code as string } : null,
    admin: admin ? { userId: admin.userId, name: admin.name, email: admin.email } : null,
    users,
    accounts: {
      total: (accCount?.n as number) ?? 0,
      rows: accounts.map((a) => ({
        id: a.id as string,
        code: a.code as string,
        name: a.name as string,
        kind: a.kind as string,
        currency: a.currency as string,
        balance: showMoney ? Number(a.current_balance ?? 0) : null,
        status: a.status as string,
        domain: (a.operational_domain as string | null) ?? null
      }))
    },
    ledgers: {
      total: (ledgerCount?.n as number) ?? 0,
      rows: ledgers.map((l) => ({
        id: l.id as string,
        code: l.code as string,
        name: l.name as string,
        currency: l.currency as string,
        balance: showMoney ? Number(l.current_balance ?? 0) : null,
        debit: showMoney ? Number(l.debit_total ?? 0) : null,
        credit: showMoney ? Number(l.credit_total ?? 0) : null
      }))
    },
    companies: companies.map((c) => ({ id: c.id as string, name: c.name as string, code: c.company_code as string | null, type: c.company_type as string | null, status: c.company_status as string | null })),
    customers: customers.map((c) => ({ id: c.id as string, name: (c.customer_name as string | null) ?? (c.company_name as string | null) ?? "—", mobile: c.mobile as string | null })),
    modules: type === "shipping" ? SHIPPING_MODULES : type === "both" ? [...new Set([...BUSINESS_MODULES, ...SHIPPING_MODULES])] : BUSINESS_MODULES,
    audit: audit.map((a) => ({ id: a.id as string, action: a.action as string, entity: a.entity_table as string, at: a.created_at as string, actor: a.actor as string })),
    separation
  };
}
