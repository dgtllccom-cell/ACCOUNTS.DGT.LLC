import { NextResponse } from "next/server";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { authorize, resolveReportScope, ErpPermissionError } from "@/lib/permissions/middleware";
import { recordInSessionScope } from "@/lib/api/scope-middleware";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

type KycEntityType = "country_branch" | "city_branch" | "user_account" | "new_account";

export type KycReportItem = {
  id: string;
  name: string;
  code?: string | null;
  type: KycEntityType;
  typeLabel: string;
  countryName: string;
  cityName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "incomplete" | "near_expiry" | "suspended" | "compliant";
  statusBadge: string;
  missingRequirements: string[];
  createdAt: string;
  graceTotalDays: number;
  daysRemaining: number;
  progressPercent: number;
  ownerName?: string | null;
  documentsCount: number;
  editUrl?: string;
  rawDetails: Record<string, any>;
};

type ScopedEntityRow = {
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
};

/**
 * ONE scope rule for every KYC entity (sessionSqlScope via recordInSessionScope). The old rule let a country login see every row with NO country, and
 * let a branch login see its WHOLE country (row.country_id === scope.countryId). A row outside the login's country / main branch / city branch,
 * or with no scope at all, is now invisible to everyone except global scope.
 */
function rowMatchesScope(session: ErpSession, row: ScopedEntityRow) {
  return recordInSessionScope(session, row);
}

/** A user is in scope when ANY of their active role assignments lies inside the login scope. */
function userInScope(session: ErpSession, assignments: ScopedEntityRow[] | undefined) {
  return (assignments ?? []).some((a) => recordInSessionScope(session, a));
}

function calculateGraceStatus(createdAt: string, missingReqs: string[]) {
  const GRACE_PERIOD_DAYS = 15;
  const createdDate = new Date(createdAt || Date.now());
  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysElapsed);
  const progressPercent = Math.min(100, Math.round((daysElapsed / GRACE_PERIOD_DAYS) * 100));

  if (missingReqs.length === 0) {
    return {
      status: "compliant" as const,
      daysRemaining,
      progressPercent: 100,
      statusBadge: "Verified & Compliant"
    };
  }

  if (daysRemaining === 0) {
    return {
      status: "suspended" as const,
      daysRemaining: 0,
      progressPercent: 100,
      statusBadge: "Suspended (Grace Period Overdue)"
    };
  }

  if (daysRemaining <= 5) {
    return {
      status: "near_expiry" as const,
      daysRemaining,
      progressPercent,
      statusBadge: `Near Expiry (${daysRemaining} Days Left)`
    };
  }

  return {
    status: "incomplete" as const,
    daysRemaining,
    progressPercent,
    statusBadge: `Incomplete (${daysRemaining} Days Left)`
  };
}

function compactBranchRawDetails(row: any) {
  return {
    owner_name: row.owner_name ?? null,
    owner_customer_id: row.owner_customer_id ?? null,
    owner_profile_id: row.owner_profile_id ?? null,
    phone: row.phone ?? row.whatsapp_number ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    documents: Array.isArray(row.documents) ? row.documents : []
  };
}

function compactUserRawDetails(row: any) {
  return {
    full_name: row.full_name ?? null
  };
}

function compactAccountRawDetails(row: any) {
  return {
    name: row.name ?? null,
    code: row.code ?? null,
    company_id: row.company_id ?? null,
    bank_id: row.bank_id ?? null,
    customer_id: row.customer_id ?? null
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    authorize(session, { resource: "kyc", action: "read" });
    const reportScope = resolveReportScope(session);

    // Audit trail: log KYC report access (fire-and-forget, non-blocking)
    auditApiAction(request as any, {
      action: "kyc.report.view",
      entityTable: "kyc_reports",
      entityId: session.userId,
      after: {
        scopeLevel: reportScope.level,
        countryId: reportScope.countryId,
        branchId: reportScope.branchId,
        viewedBy: session.userId,
        roles: session.roles
      }
    }).catch(() => { /* non-blocking */ });

    const sourceData = await withLocalPg(async (sql) => {

      async function timedQuery<T>(label: string, query: Promise<T>) {
        return await query;
      }

      const countries = await timedQuery(
        "countries",
        sql`
          select id, name, iso2, currency_code, official_email, admin_email, created_at
          from public.countries
          where deleted_at is null
        `
      );
      const countryBranches = await timedQuery(
        "countryBranches",
        sql`
          select id, country_id, name, code, is_main, address, phone, email, whatsapp_number, owner_name, owner_customer_id, owner_profile_id, documents, contacts, created_at
          from public.country_branches
          where deleted_at is null
        `
      );
      const cityBranches = await timedQuery(
        "cityBranches",
        sql`
          select id, country_id, country_branch_id, name, code, address, phone, email, owner_name, owner_customer_id, owner_profile_id, contacts, documents, created_at
          from public.city_branches
          where deleted_at is null
        `
      );
      const assignments = await timedQuery(
        "assignments",
        sql`
          select user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at
          from public.user_role_assignments
          where deleted_at is null
        `
      );
      // only the logins whose assignment lies inside the caller scope (the old "50 newest of everybody, then filter" could hide every in-scope user)
      const scopedUserIds = [
        ...new Set(
          (assignments as any[])
            .filter((a) => a?.user_id && a.is_active !== false && recordInSessionScope(session, a))
            .map((a) => String(a.user_id))
        )
      ];
      const users = scopedUserIds.length
        ? await timedQuery(
            "profiles",
            sql`
              select id, full_name, preferred_language_code, created_at
              from public.profiles
              where id = any(${scopedUserIds}::uuid[])
              order by created_at desc
              limit 500
            `
          )
        : [];
      const enterpriseAccounts = await timedQuery(
        "enterpriseAccounts",
        sql`
          select id, code, name, country_id, country_branch_id, city_branch_id, company_id, bank_id, customer_id, created_at
          from public.enterprise_accounts
          where deleted_at is null
          order by created_at desc
          limit 100
        `
      );
      const companies = await timedQuery(
        "companies",
        sql`
          select id, name, legal_name, company_code, address, country_id, city_id, owner_name, contacts, created_at
          from public.companies
          where deleted_at is null
          order by created_at desc
          limit 50
        `
      );
      const customers = await timedQuery(
        "customers",
        sql`
          select id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, country_id, created_at
          from public.customers
          where deleted_at is null
          order by created_at desc
          limit 50
        `
      );
      return { countries, countryBranches, cityBranches, users, assignments, enterpriseAccounts, companies, customers };
    });
    const supabase = createSupabaseAdminClient() as any;
    const [
      countriesRes,
      countryBranchesRes,
      cityBranchesRes,
      usersRes,
      assignmentsRes,
      enterpriseAccountsRes,
      companiesRes,
      customersRes
    ] = sourceData
      ? [
          { data: sourceData.countries },
          { data: sourceData.countryBranches },
          { data: sourceData.cityBranches },
          { data: sourceData.users },
          { data: sourceData.assignments },
          { data: sourceData.enterpriseAccounts },
          { data: sourceData.companies },
          { data: sourceData.customers }
        ]
      : await Promise.all([
          supabase.from("countries").select("id, name, iso2, currency_code, official_email, admin_email, created_at").is("deleted_at", null),
          supabase.from("country_branches").select("id, country_id, name, code, is_main, address, phone, email, whatsapp_number, owner_name, owner_customer_id, owner_profile_id, documents, contacts, created_at").is("deleted_at", null),
          supabase.from("city_branches").select("id, country_id, country_branch_id, name, code, address, phone, email, owner_name, owner_customer_id, owner_profile_id, contacts, documents, created_at").is("deleted_at", null),
          supabase.from("profiles").select("id, full_name, preferred_language_code, created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("user_role_assignments").select("user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at").is("deleted_at", null),
          supabase.from("enterprise_accounts").select("id, code, name, country_id, country_branch_id, city_branch_id, company_id, bank_id, customer_id, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
          supabase.from("companies").select("id, name, legal_name, company_code, address, country_id, city_id, owner_name, contacts, created_at").is("deleted_at", null).limit(50),
          supabase.from("customers").select("id, customer_name, company_name, contact_person, mobile, whatsapp, email, address, country_id, created_at").is("deleted_at", null).limit(50)
        ]);

    const countriesMap = new Map<string, string>();
    (countriesRes.data ?? []).forEach((c: any) => {
      countriesMap.set(c.id, c.name);
    });

    const userAssignmentScope = new Map<string, ScopedEntityRow[]>();
    (assignmentsRes.data ?? []).forEach((assignment: any) => {
      if (!assignment?.user_id || assignment.is_active === false) return;
      const list = userAssignmentScope.get(assignment.user_id) ?? [];
      list.push({ country_id: assignment.country_id ?? null, country_branch_id: assignment.country_branch_id ?? null, city_branch_id: assignment.city_branch_id ?? null });
      userAssignmentScope.set(assignment.user_id, list);
    });

    const items: KycReportItem[] = [];

    // 1. Process Country Branches (e.g. Pakistan Country Branch)
    (countryBranchesRes.data ?? []).forEach((cb: any) => {
      if (!rowMatchesScope(session, { country_id: cb.country_id, country_branch_id: cb.id })) return;
      const missing: string[] = [];
      if (!cb.owner_name) missing.push("Missing Registered Owner Name");
      if (!cb.phone && !cb.whatsapp_number) missing.push("Missing Contact Phone / WhatsApp");
      if (!cb.address) missing.push("Missing Official Physical Address");
      if (!Array.isArray(cb.documents) || cb.documents.length === 0) missing.push("Missing NTN / Trade License Documents");
      if (!cb.email) missing.push("Missing Official Email Account");

      const countryName = countriesMap.get(cb.country_id) || "Global";
      const grace = calculateGraceStatus(cb.created_at, missing);

      items.push({
        id: cb.id,
        name: `${countryName} - ${cb.name || "Main Branch"}`,
        code: cb.code || "CB-MAIN",
        type: "country_branch",
        typeLabel: "Country Main Branch",
        countryName,
        email: cb.email,
        phone: cb.phone || cb.whatsapp_number,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: cb.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        ownerName: cb.owner_name,
        documentsCount: Array.isArray(cb.documents) ? cb.documents.length : 0,
        editUrl: `/dashboard/new-entry/branch-entry/country-branch?id=${cb.id}`,
        rawDetails: compactBranchRawDetails(cb)
      });
    });

    // 2. Process City Branches (e.g. Lahore / Karachi Branches)
    (cityBranchesRes.data ?? []).forEach((cbr: any) => {
      if (!rowMatchesScope(session, { country_id: cbr.country_id, country_branch_id: cbr.country_branch_id, city_branch_id: cbr.id })) return;
      const missing: string[] = [];
      if (!cbr.phone) missing.push("Missing Branch Telephone");
      if (!cbr.address) missing.push("Missing City Branch Physical Address");
      if (!Array.isArray(cbr.documents) || cbr.documents.length === 0) missing.push("Missing Municipal Trade License / Registration Certificate");
      if (!cbr.email) missing.push("Missing Branch Email");

      const countryName = countriesMap.get(cbr.country_id) || "Branch Node";
      const grace = calculateGraceStatus(cbr.created_at, missing);

      items.push({
        id: cbr.id,
        name: cbr.name || "City Branch",
        code: cbr.code || "CITY-BR",
        type: "city_branch",
        typeLabel: "City Branch Node",
        countryName,
        cityName: cbr.name,
        email: cbr.email,
        phone: cbr.phone,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: cbr.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: Array.isArray(cbr.documents) ? cbr.documents.length : 0,
        editUrl: `/dashboard/new-entry/branch-entry/city-branch?id=${cbr.id}`,
        rawDetails: compactBranchRawDetails(cbr)
      });
    });

    // 3. Process User Accounts (Staff / Employees)
    (usersRes.data ?? []).forEach((u: any) => {
      if (!userInScope(session, userAssignmentScope.get(u.id))) return;
      const missing: string[] = [];
      // Check real DB fields — only flag missing if column actually absent
      if (!u.full_name) missing.push("Missing Official Full Name Verification");
      // cnic_doc_url / passport_doc_url — flag only if the column exists and is null
      if (u.hasOwnProperty("cnic_doc_url") && !u.cnic_doc_url) {
        missing.push("Missing Identity CNIC / Passport Copy");
      } else if (u.hasOwnProperty("kyc_document_count") && !u.kyc_document_count) {
        missing.push("Missing Identity CNIC / Passport Copy");
      }

      const grace = calculateGraceStatus(u.created_at, missing);

      items.push({
        id: u.id,
        name: u.full_name || "User Account",
        code: `USR-${u.id.substring(0, 6).toUpperCase()}`,
        type: "user_account",
        typeLabel: "Employee / User Account",
        countryName: "System Registered",
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: u.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: 0,
        editUrl: `/dashboard/new-entry/users/registration?id=${u.id}`,
        rawDetails: compactUserRawDetails(u)
      });
    });

    // 4. Process Commercial / New Enterprise Accounts (including newly created ones)
    (enterpriseAccountsRes.data ?? []).forEach((acc: any) => {
      if (!rowMatchesScope(session, acc)) return;
      const missing: string[] = [];
      if (!acc.name) missing.push("Missing Account Title");
      // Only flag NTN/tax registration if the column exists and is empty
      if (acc.hasOwnProperty("ntn_number") && !acc.ntn_number) {
        missing.push("Missing Commercial Tax / NTN Registration");
      }
      // Only flag owner ID proof if the column exists and is empty
      if (acc.hasOwnProperty("owner_id_proof_url") && !acc.owner_id_proof_url) {
        missing.push("Missing Owner ID Proof");
      }

      const countryName = countriesMap.get(acc.country_id) || "General Ledger";
      const grace = calculateGraceStatus(acc.created_at, missing);

      items.push({
        id: acc.id,
        name: acc.name || `Account ${acc.code}`,
        code: acc.code || "ACC-NEW",
        type: "new_account",
        typeLabel: "New Ledger Account",
        countryName,
        status: grace.status,
        statusBadge: grace.statusBadge,
        missingRequirements: missing,
        createdAt: acc.created_at || new Date().toISOString(),
        graceTotalDays: 15,
        daysRemaining: grace.daysRemaining,
        progressPercent: grace.progressPercent,
        documentsCount: 0,
        editUrl: `/dashboard/accounts/setup?id=${acc.id}`,
        rawDetails: compactAccountRawDetails(acc)
      });
    });

    // Metrics summary
    const metrics = {
      total: items.length,
      incomplete: items.filter((i) => i.status === "incomplete").length,
      nearExpiry: items.filter((i) => i.status === "near_expiry").length,
      suspended: items.filter((i) => i.status === "suspended").length,
      compliant: items.filter((i) => i.status === "compliant").length
    };
    return NextResponse.json({
      items,
      metrics,
      scope: reportScope,
      totals: {
        countries: (countriesRes.data ?? []).filter((c: any) => rowMatchesScope(session, { country_id: c.id })).length,
        countryBranches: items.filter((i) => i.type === "country_branch").length,
        cityBranches: items.filter((i) => i.type === "city_branch").length,
        users: items.filter((i) => i.type === "user_account").length,
        enterpriseAccounts: items.filter((i) => i.type === "new_account").length,
        companies: (companiesRes.data ?? []).filter((row: any) => rowMatchesScope(session, { country_id: row.country_id })).length,
        customers: (customersRes.data ?? []).filter((row: any) => rowMatchesScope(session, { country_id: row.country_id })).length
      }
    }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ErpPermissionError) {
      return NextResponse.json({ error: error.message, items: [], metrics: { total: 0, incomplete: 0, nearExpiry: 0, suspended: 0, compliant: 0 } }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to load KYC reports.";
    return NextResponse.json({ error: message, items: [], metrics: { total: 0, incomplete: 0, nearExpiry: 0, suspended: 0, compliant: 0 } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "kyc", action: "update" });
    const body = await request.json();

    const { entityId, entityType, action, ownerName, ownerCustomerId, ownerProfileId, phone, email, address, documents } = body;

    if (!entityId || !entityType) {
      return NextResponse.json({ error: "Missing entityId or entityType" }, { status: 400 });
    }
    if (!["country_branch", "city_branch", "user_account"].includes(String(entityType)) || !/^[0-9a-fA-F-]{36}$/.test(String(entityId))) {
      return NextResponse.json({ error: "Unsupported KYC entity" }, { status: 400 });
    }

    // the update runs with the service-role client, so the caller scope is checked HERE against the stored record (never trusting the browser)
    const target = await withLocalPg(async (sql) => {
      if (entityType === "country_branch") {
        const r = await sql`select country_id::text country_id, id::text country_branch_id from public.country_branches where id = ${entityId}::uuid and deleted_at is null`;
        return r[0] ? ([{ country_id: r[0].country_id, country_branch_id: r[0].country_branch_id }] as ScopedEntityRow[]) : null;
      }
      if (entityType === "city_branch") {
        const r = await sql`select country_id::text country_id, country_branch_id::text country_branch_id, id::text city_branch_id from public.city_branches where id = ${entityId}::uuid and deleted_at is null`;
        return r[0] ? ([{ country_id: r[0].country_id, country_branch_id: r[0].country_branch_id, city_branch_id: r[0].city_branch_id }] as ScopedEntityRow[]) : null;
      }
      const r = await sql`select country_id::text country_id, country_branch_id::text country_branch_id, city_branch_id::text city_branch_id from public.user_role_assignments where user_id = ${entityId}::uuid and deleted_at is null and coalesce(is_active, true)`;
      return r.length ? (r as unknown as ScopedEntityRow[]) : null;
    });
    if (!target || !target.some((row) => recordInSessionScope(session, row))) {
      return NextResponse.json({ error: "KYC record not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdminClient() as any;

    if (entityType === "country_branch") {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (ownerName) updateData.owner_name = ownerName.trim();
      if (ownerCustomerId !== undefined) updateData.owner_customer_id = ownerCustomerId || null;
      if (ownerProfileId !== undefined) updateData.owner_profile_id = ownerProfileId || null;
      if (phone) updateData.phone = phone.trim();
      if (email) updateData.email = email.trim().toLowerCase();
      if (address) updateData.address = address.trim();
      if (Array.isArray(documents)) updateData.documents = documents;

      await supabase.from("country_branches").update(updateData).eq("id", entityId);
    } else if (entityType === "city_branch") {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (ownerName) updateData.owner_name = ownerName.trim();
      if (ownerCustomerId !== undefined) updateData.owner_customer_id = ownerCustomerId || null;
      if (ownerProfileId !== undefined) updateData.owner_profile_id = ownerProfileId || null;
      if (phone) updateData.phone = phone.trim();
      if (email) updateData.email = email.trim().toLowerCase();
      if (address) updateData.address = address.trim();
      if (Array.isArray(documents)) updateData.documents = documents;

      await supabase.from("city_branches").update(updateData).eq("id", entityId);
    } else if (entityType === "user_account") {
      if (ownerName) {
        await supabase.from("profiles").update({ full_name: ownerName.trim() }).eq("id", entityId);
      }
    }

    await auditApiAction(request as any, {
      action: "kyc.update.api",
      entityTable: entityType,
      entityId,
      after: { action, ownerName, phone, email, address, documentsCount: documents?.length ?? 0 }
    });

    return NextResponse.json({ ok: true, message: "KYC records updated successfully!" }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ErpPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to update KYC record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
