import { NextResponse } from "next/server";
import { createCountryBranchSchema } from "@/features/branch-management/validation";
import { countryBranchDomainAccess } from "@/features/branches/lib/country-branch-domain-access";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { allPermissionGroupKeys } from "@/lib/permissions/catalog";
import { linkEmailAccount } from "@/lib/api/email-link";
import { translateToUrdu, rethrowIfNextControlFlow } from "@/lib/api/response";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";
import { locationsRepository } from "@/lib/repositories/locations-repository";

function formatError(message: string, _isSuperAdmin?: boolean) {
  return message;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const countryBranchSelect =
  "id,country_id,operational_domain,parent_country_branch_id,name,code,local_currency,is_main,status,state_province_id,district_id,city_id,address,phone,email,whatsapp_number,company_id,owner_name,owner_customer_id,owner_profile_id,contacts,documents,permission_template,permission_grants,created_at,updated_at";

const countryBranchFallbackSelect =
  "id,country_id,operational_domain,parent_country_branch_id,name,code,local_currency,is_main,status,state_province_id,district_id,city_id,address,phone,email,whatsapp_number,company_id,owner_name,owner_customer_id,owner_profile_id,contacts,documents,created_at,updated_at";

function isMissingOptionalColumn(message: string) {
  return /permission_template|permission_grants/i.test(message);
}

/** Stored values win; the defaults only fill a NULL (a row saved without a template still reads back as the standard one). */
function normalizeCountryBranchRows(rows: any[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    ...row,
    permission_template: row.permission_template ?? "country-standard",
    permission_grants: Array.isArray(row.permission_grants) ? row.permission_grants : []
  }));
}

/** Catalog group keys that the save API does not accept (empty list = all keys valid). */
function invalidPermissionGroups(permissionGrants: string[]): string[] {
  const allowed = new Set(allPermissionGroupKeys());
  return permissionGrants.filter((permission) => !allowed.has(permission));
}

/**
 * Live unique indexes on country_branches (see the migrations that created them).
 * Each maps a SQLSTATE 23505 to a stable code the page can translate.
 */
const COUNTRY_BRANCH_UNIQUE_INDEX: Record<string, { code: "DUPLICATE_BRANCH" | "MAIN_BRANCH_EXISTS"; field: string; message: string }> = {
  country_branches_code_idx: {
    code: "DUPLICATE_BRANCH",
    field: "code",
    message: "Branch Code is already used by another Country branch in this country. Use a different Branch Code."
  },
  country_one_main_branch_per_domain_idx: {
    code: "MAIN_BRANCH_EXISTS",
    field: "operationalDomain",
    message: "A main branch already exists for this country under this section. Saving updates that branch."
  }
};

function uniqueViolationResponse(error: unknown): NextResponse | null {
  const e = (error ?? {}) as { code?: string; constraint_name?: string; constraint?: string };
  if (e.code !== "23505") return null;
  const hit = COUNTRY_BRANCH_UNIQUE_INDEX[e.constraint_name || e.constraint || ""];
  if (hit) {
    return NextResponse.json({ error: hit.message, code: hit.code, field: hit.field }, { status: 409 });
  }
  return NextResponse.json(
    { error: "Duplicate country branch: this country, code or section already exists. Nothing was changed.", code: "DUPLICATE_BRANCH", field: "scope" },
    { status: 409 }
  );
}

/**
 * Runs a linked-account write after the branch row is already saved. A failure is reported back as a
 * warning instead of an error, so the branch is never reported as "not saved" when it was.
 */
async function sideEffect(warnings: string[], label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    warnings.push(`${label} was not saved: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function loadCountry(countryId: string): Promise<{ name: string; currency: string | null } | null> {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = (await sql`
      select name, currency_code from public.countries
       where id = ${countryId}::uuid and deleted_at is null
       limit 1
    `) as any[];
    return { row: rows[0] ? { name: String(rows[0].name ?? ""), currency: rows[0].currency_code ?? null } : null };
  });
  if (viaPg) return viaPg.row;
  const supabase = createSupabaseAdminClient() as any;
  const { data } = await supabase
    .from("countries")
    .select("name,currency_code")
    .eq("id", countryId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? { name: String(data.name ?? ""), currency: data.currency_code ?? null } : null;
}

async function findMainBranch(countryId: string, domain: string, excludeId?: string) {
  return withLocalPg(async (sql) => {
    const rows = (await sql`
      select id, country_id, name, code, local_currency, is_main, status
        from public.country_branches
       where country_id = ${countryId}::uuid
         and coalesce(operational_domain, 'business') = ${domain}
         and is_main = true
         and deleted_at is null
         and (${excludeId ? sql`id <> ${excludeId}::uuid` : sql`true`})
       limit 1
    `) as any[];
    return rows[0] ?? null;
  });
}

async function readSavedBranch(id: string) {
  return withLocalPg(async (sql) => {
    const rows = (await sql`
      select id, name, code, status, operational_domain, is_main, deleted_at, updated_at
        from public.country_branches
       where id = ${id}::uuid
       limit 1
    `) as any[];
    return rows[0] ?? null;
  });
}

/** Saved-record detail for the Country Main Branch page: location names, the users assigned directly to this branch, linked documents, creator. */
async function loadCountryBranchDetail(row: { id: string }) {
  return withLocalPg(async (sql) => {
    const locRows = (await sql`
      select cnt.name as country_name, cnt.iso2 as country_iso2, cnt.iso3 as country_iso3,
             cnt.currency_code as country_currency, cnt.phone_code as country_phone_code,
             sp.name as state_name, di.name as district_name,
             ct.name as city_name, ct.code as city_code, ct.zip_code as city_zip,
             pf.full_name as created_by_name
        from public.country_branches cb
        left join public.countries cnt on cnt.id = cb.country_id
        left join public.states_provinces sp on sp.id = cb.state_province_id
        left join public.districts di on di.id = cb.district_id
        left join public.cities ct on ct.id = cb.city_id
        left join public.profiles pf on pf.id = cb.created_by
       where cb.id = ${row.id}::uuid
       limit 1
    `) as any[];
    const loc = locRows[0] ?? {};

    // Users assigned to this main branch itself (city-level assignments belong to the City Branch page).
    const users = (await sql`
      select ura.id as assignment_id, ura.user_id, ura.role::text as role,
             ura.operational_domain, ura.access_profile, ura.is_active,
             p.full_name, p.user_code
        from public.user_role_assignments ura
        left join public.profiles p on p.id = ura.user_id
       where ura.country_branch_id = ${row.id}::uuid
         and ura.city_branch_id is null
         and ura.is_active = true
         and ura.deleted_at is null
       order by ura.created_at asc
    `) as any[];

    const docs = (await sql`
      select id, name, mime_type, size_bytes, created_at
        from public.erp_documents
       where deleted_at is null
         and entity_type = 'country_branch'
         and entity_id = ${row.id}::uuid
       order by created_at desc
    `) as any[];

    return {
      location: {
        countryName: loc.country_name ?? "",
        countryIso2: loc.country_iso2 ?? "",
        countryIso3: loc.country_iso3 ?? "",
        countryCurrency: loc.country_currency ?? "",
        countryPhoneCode: loc.country_phone_code ?? "",
        stateName: loc.state_name ?? "",
        districtName: loc.district_name ?? "",
        cityName: loc.city_name ?? "",
        cityCode: loc.city_code ?? "",
        cityZip: loc.city_zip ?? "",
        areaName: "",
        areaPostal: ""
      },
      createdByName: loc.created_by_name ?? "",
      linkedUsers: users.map((u) => ({
        assignmentId: u.assignment_id,
        userId: u.user_id,
        userName: u.full_name ?? "",
        userCode: u.user_code ?? "",
        role: u.role ?? "",
        operationalDomain: u.operational_domain ?? "business",
        accessProfile: u.access_profile ?? "",
        isActive: u.is_active !== false
      })),
      linkedDocuments: docs.map((d) => ({
        id: d.id,
        name: d.name,
        mimeType: d.mime_type ?? "",
        sizeBytes: d.size_bytes ?? null,
        createdAt: d.created_at ? new Date(d.created_at).toISOString() : ""
      }))
    };
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const countryIdRaw = url.searchParams.get("countryId");
    const countryId = countryIdRaw ? await locationsRepository.resolveCountryUuid(countryIdRaw) : null;
    const operationalDomain = url.searchParams.get("operationalDomain");

    // Root-cause bypass: country_branches_scope_read gates on is_super_admin()/
    // can_access_country(), both keyed off auth.uid(), which is always NULL under
    // the app's temp-session bootstrap login — so the "admin" Supabase client below
    // silently returns zero rows for every filtered branch lookup. Try a direct
    // Postgres read first (bypasses RLS via DATABASE_URL); fall back to the
    // Supabase-client path only when DATABASE_URL isn't configured.
    const viaPg = await withLocalPg(async (sql) => {
      if (id && !isUuid(id)) return { countryBranches: [] as any[] };
      if (countryId && !session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(countryId)) {
        return { countryBranches: [] as any[] };
      }
      if (!countryId && !session.isSuperAdmin && session.countryIds.length === 0) {
        return { countryBranches: [] as any[] };
      }
      const rows = await sql`
        select
          id, country_id, operational_domain, parent_country_branch_id, name, code, local_currency, is_main, status, state_province_id,
          district_id, city_id, address, phone, email, whatsapp_number, company_id, owner_name,
          owner_customer_id, owner_profile_id,
          contacts, documents, permission_template, permission_grants, created_at, updated_at
        from public.country_branches
        where deleted_at is null
          and (${id && isUuid(id) ? sql`id = ${id}` : sql`true`})
          and (${countryId ? sql`country_id = ${countryId}::uuid` : sql`true`})
          and (${!countryId && !session.isSuperAdmin ? sql`country_id = any(${session.countryIds})` : sql`true`})
          and (${operationalDomain ? sql`(coalesce(operational_domain, 'business') = ${operationalDomain} or is_main = true)` : sql`true`})
        order by created_at asc
      `;
      return { countryBranches: normalizeCountryBranchRows(rows as any[]) };
    });

    let countryBranches: any[];
    if (viaPg) {
      countryBranches = viaPg.countryBranches;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const query = buildCountryBranchQuery(supabase, countryBranchSelect, id, countryId, session, operationalDomain);
      if (!query) return NextResponse.json({ countryBranches: [] }, { status: 200 });

      let { data, error } = await query;
      if (error && isMissingOptionalColumn(error.message)) {
        const fallbackQuery = buildCountryBranchQuery(supabase, countryBranchFallbackSelect, id, countryId, session, operationalDomain);
        const fallbackResult = fallbackQuery ? await fallbackQuery : { data: [], error: null };
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      countryBranches = normalizeCountryBranchRows(data);
    }

    const lang = await getRequestLanguage();
    countryBranches = await localizeRecordNames(countryBranches, "country_branches", "name", lang);

    // Saved-record detail (edit / view / print): one branch with its location names, direct users and documents.
    if (id && isUuid(id) && url.searchParams.get("detail") === "1") {
      const row = countryBranches[0] ?? null;
      if (!row) return NextResponse.json({ countryBranches, detail: null, detailError: null }, { status: 200 });
      try {
        const detail = await loadCountryBranchDetail({ id: row.id });
        // Codes are translated by the page; a database error text is passed through as data.
        return NextResponse.json({ countryBranches, detail, detailError: detail ? null : "NO_DATABASE" }, { status: 200 });
      } catch (detailError) {
        const message = detailError instanceof Error && detailError.message ? detailError.message : "DETAIL_FAILED";
        return NextResponse.json({ countryBranches, detail: null, detailError: message }, { status: 200 });
      }
    }
    return NextResponse.json({ countryBranches }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load country branches.";
    return NextResponse.json({ error: message, countryBranches: [] }, { status: 500 });
  }
}

function buildCountryBranchQuery(
  supabase: any,
  selectColumns: string,
  id: string | null,
  countryId: string | null,
  session: Awaited<ReturnType<typeof requireErpSession>>,
  operationalDomain?: string | null
) {
  let query = supabase
    .from("country_branches")
    .select(selectColumns)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (id && isUuid(id)) {
    query = query.eq("id", id);
  }

  if (countryId) {
    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return null;
    }
    query = query.eq("country_id", countryId);
  } else if (!session.isSuperAdmin) {
    query = query.in(
      "country_id",
      session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  if (operationalDomain) {
    if (operationalDomain === "business") {
      query = query.or("operational_domain.eq.business,operational_domain.is.null,is_main.eq.true");
    } else {
      query = query.or(`operational_domain.eq.${operationalDomain},is_main.eq.true`);
    }
  }

  return query;
}

/** Builds the row written by POST and PUT from the validated body and the country's currency. */
function buildCountryBranchPayload(data: ReturnType<typeof createCountryBranchSchema.parse>, currency: string) {
  const domain = data.operationalDomain || "business";
  const now = new Date().toISOString();
  return {
    country_id: data.countryId,
    operational_domain: domain,
    parent_country_branch_id: data.parentCountryBranchId ?? null,
    name: data.name.trim(),
    code: data.code.trim().toUpperCase(),
    local_currency: currency,
    is_main: true,
    status: "active",
    state_province_id: data.stateProvinceId ?? null,
    district_id: data.districtId ?? null,
    city_id: data.cityId ?? null,
    address: data.address?.trim() ? data.address.trim() : null,
    phone: data.phone?.trim() ? data.phone.trim() : null,
    email: data.email.trim().toLowerCase(),
    whatsapp_number: data.whatsappNumber?.trim() || null,
    company_id: data.companyId ?? null,
    owner_name: data.ownerName?.trim() ? data.ownerName.trim() : null,
    owner_customer_id: data.ownerCustomerId ?? null,
    owner_profile_id: data.ownerProfileId ?? null,
    contacts: data.contacts ?? [],
    documents: data.documents ?? [],
    permission_template: data.permissionTemplate ?? null,
    permission_grants: data.permissionGrants,
    updated_at: now
  };
}

function savedSummary(saved: any | null, fallback: { id: string; code: string; name: string; status: string }) {
  const visibility = saved ? countryBranchDomainAccess(saved) : null;
  return {
    id: fallback.id,
    code: saved?.code ?? fallback.code,
    name: saved?.name ?? fallback.name,
    status: saved?.status ?? fallback.status,
    updatedAt: saved?.updated_at ? new Date(saved.updated_at).toISOString() : null,
    // Shipping Lane and Business module visibility, read back from the saved row (item 9).
    domainAccess: visibility
  };
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof requireErpSession>> | undefined;
  try {
    session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can create country main branches." }, { status: 403 });
    }

    const parsed = createCountryBranchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const invalid = invalidPermissionGroups(parsed.data.permissionGrants);
    if (invalid.length) {
      return NextResponse.json({ error: `Invalid permission group(s): ${invalid.join(", ")}`, code: "INVALID_PERMISSION_GROUPS" }, { status: 400 });
    }

    const country = await loadCountry(parsed.data.countryId);
    if (!country) {
      return NextResponse.json({ error: "Country not found.", code: "COUNTRY_NOT_FOUND" }, { status: 404 });
    }
    const currency = String(country.currency ?? "").trim().toUpperCase();
    if (currency.length !== 3) {
      return NextResponse.json({ error: "The selected country has no currency code.", code: "COUNTRY_CURRENCY_MISSING" }, { status: 422 });
    }

    const domain = parsed.data.operationalDomain || "business";
    const existingMainBranch = await findMainBranch(parsed.data.countryId, domain);
    if (existingMainBranch?.id) {
      return NextResponse.json(
        {
          error: `A main branch already exists for this country under the ${domain === "shipping" ? "Shipping Line & Clearing Agent" : "Business"} section. Saving updates that branch.`,
          code: "MAIN_BRANCH_EXISTS",
          existingBranch: existingMainBranch
        },
        { status: 409 }
      );
    }

    const createdBy = isUuid(session.userId) ? session.userId : null;
    const payload = {
      ...buildCountryBranchPayload(parsed.data, currency),
      created_by: createdBy,
      created_at: new Date().toISOString()
    };

    let insertedId: string | null = null;
    try {
      insertedId = await withLocalPg(async (sql) => {
        const rows = await sql`
          insert into public.country_branches (
            country_id, operational_domain, parent_country_branch_id, name, code, local_currency,
            is_main, status, state_province_id, district_id, city_id, address, phone, email,
            whatsapp_number, company_id, owner_name, owner_customer_id, owner_profile_id,
            contacts, documents, permission_template, permission_grants, created_by,
            created_at, updated_at
          ) values (
            ${payload.country_id}::uuid,
            ${payload.operational_domain},
            ${payload.parent_country_branch_id ? payload.parent_country_branch_id : null}::uuid,
            ${payload.name},
            ${payload.code},
            ${payload.local_currency},
            ${payload.is_main},
            ${payload.status},
            ${payload.state_province_id ? payload.state_province_id : null}::uuid,
            ${payload.district_id ? payload.district_id : null}::uuid,
            ${payload.city_id ? payload.city_id : null}::uuid,
            ${payload.address},
            ${payload.phone},
            ${payload.email},
            ${payload.whatsapp_number},
            ${payload.company_id ? payload.company_id : null}::uuid,
            ${payload.owner_name},
            ${payload.owner_customer_id ? payload.owner_customer_id : null}::uuid,
            ${payload.owner_profile_id ? payload.owner_profile_id : null}::uuid,
            ${sql.json(payload.contacts)},
            ${sql.json(payload.documents)},
            ${payload.permission_template},
            ${sql.json(payload.permission_grants)},
            ${payload.created_by}::uuid,
            ${payload.created_at},
            ${payload.updated_at}
          )
          returning id
        `;
        return rows[0]?.id ?? null;
      });
    } catch (error) {
      const dup = uniqueViolationResponse(error);
      if (dup) return dup;
      throw error;
    }

    if (!insertedId) {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase.from("country_branches").insert(payload).select("id").single();
      if (error) {
        const dup = uniqueViolationResponse(error);
        if (dup) return dup;
        return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 500 });
      }
      insertedId = data?.id ?? null;
    }

    if (!insertedId) {
      return NextResponse.json({ error: "Failed to create country branch record.", code: "SAVE_FAILED" }, { status: 500 });
    }

    void syncRecordTranslations({
      table: "country_branches",
      recordId: insertedId,
      record: payload,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    }).catch(() => {});

    // The row is saved: linked-account and audit failures become warnings, never a failed save.
    const warnings: string[] = [];
    await sideEffect(warnings, "Email account link", () => linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: insertedId,
      scope: "country_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email
    }));
    await sideEffect(warnings, "Audit log", () => auditApiAction(request as any, {
      action: "country_branches.create.api",
      entityTable: "country_branches",
      entityId: insertedId,
      after: payload
    }));

    const saved = await readSavedBranch(insertedId);
    return NextResponse.json(
      { ...savedSummary(saved, { id: insertedId, code: payload.code, name: payload.name, status: payload.status }), warnings },
      { status: 201 }
    );
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const isSuperAdmin = typeof session !== "undefined" && (session as any)?.isSuperAdmin;
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: formatError(msg, isSuperAdmin) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let session: Awaited<ReturnType<typeof requireErpSession>> | undefined;
  try {
    session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can update country main branches." }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Valid main branch id is required." }, { status: 400 });
    }

    const parsed = createCountryBranchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const invalid = invalidPermissionGroups(parsed.data.permissionGrants);
    if (invalid.length) {
      return NextResponse.json({ error: `Invalid permission group(s): ${invalid.join(", ")}`, code: "INVALID_PERMISSION_GROUPS" }, { status: 400 });
    }

    const country = await loadCountry(parsed.data.countryId);
    if (!country) {
      return NextResponse.json({ error: "Country not found.", code: "COUNTRY_NOT_FOUND" }, { status: 404 });
    }
    const currency = String(country.currency ?? "").trim().toUpperCase();
    if (currency.length !== 3) {
      return NextResponse.json({ error: "The selected country has no currency code.", code: "COUNTRY_CURRENCY_MISSING" }, { status: 422 });
    }

    const domain = parsed.data.operationalDomain || "business";
    const duplicateMainBranch = await findMainBranch(parsed.data.countryId, domain, id);
    if (duplicateMainBranch?.id) {
      return NextResponse.json(
        {
          error: `A main branch already exists for this country under the ${domain === "shipping" ? "Shipping Line & Clearing Agent" : "Business"} section. Edit that branch instead.`,
          code: "MAIN_BRANCH_EXISTS",
          existingBranch: duplicateMainBranch
        },
        { status: 409 }
      );
    }

    // created_by / created_at are never changed on update.
    const updatable = buildCountryBranchPayload(parsed.data, currency);

    let updatedId: string | null = null;
    let notFound = false;
    try {
      const pgResult = await withLocalPg(async (sql) => {
        const rows = (await sql`
          update public.country_branches
          set
            country_id = ${updatable.country_id}::uuid,
            operational_domain = ${updatable.operational_domain},
            name = ${updatable.name},
            code = ${updatable.code},
            local_currency = ${updatable.local_currency},
            is_main = ${updatable.is_main},
            status = ${updatable.status},
            state_province_id = ${updatable.state_province_id ? updatable.state_province_id : null}::uuid,
            district_id = ${updatable.district_id ? updatable.district_id : null}::uuid,
            city_id = ${updatable.city_id ? updatable.city_id : null}::uuid,
            address = ${updatable.address},
            phone = ${updatable.phone},
            email = ${updatable.email},
            whatsapp_number = ${updatable.whatsapp_number},
            company_id = ${updatable.company_id ? updatable.company_id : null}::uuid,
            owner_name = ${updatable.owner_name},
            owner_customer_id = ${updatable.owner_customer_id ? updatable.owner_customer_id : null}::uuid,
            owner_profile_id = ${updatable.owner_profile_id ? updatable.owner_profile_id : null}::uuid,
            contacts = ${sql.json(updatable.contacts)},
            documents = ${sql.json(updatable.documents)},
            permission_template = ${updatable.permission_template},
            permission_grants = ${sql.json(updatable.permission_grants)},
            updated_at = now()
          where id = ${id}::uuid and deleted_at is null
          returning id
        `) as any[];
        return { id: rows[0]?.id ?? null };
      });
      if (pgResult) {
        updatedId = pgResult.id;
        notFound = !pgResult.id;
      }
    } catch (error) {
      const dup = uniqueViolationResponse(error);
      if (dup) return dup;
      throw error;
    }

    if (updatedId === null && !notFound) {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("country_branches")
        .update(updatable)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) {
        const dup = uniqueViolationResponse(error);
        if (dup) return dup;
        return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 500 });
      }
      updatedId = data?.id ?? null;
      notFound = !data;
    }

    if (notFound || !updatedId) {
      return NextResponse.json({ error: "Country main branch record not found.", code: "BRANCH_NOT_FOUND" }, { status: 404 });
    }

    void syncRecordTranslations({
      table: "country_branches",
      recordId: updatedId,
      record: updatable,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    }).catch(() => {});

    const warnings: string[] = [];
    await sideEffect(warnings, "Email account link", () => linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: id,
      scope: "country_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email
    }));
    await sideEffect(warnings, "Audit log", () => auditApiAction(request as any, {
      action: "country_branches.update.api",
      entityTable: "country_branches",
      entityId: id,
      after: updatable
    }));

    const saved = await readSavedBranch(id);
    return NextResponse.json(
      { ...savedSummary(saved, { id, code: updatable.code, name: updatable.name, status: updatable.status }), warnings },
      { status: 200 }
    );
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const isSuperAdmin = typeof session !== "undefined" && (session as any)?.isSuperAdmin;
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: formatError(msg, isSuperAdmin) }, { status: 500 });
  }
}
