import { NextResponse } from "next/server";
import { createCityBranchSchema } from "@/features/branch-management/validation";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { allPermissionGroupKeys, constrainChildPermissions } from "@/lib/permissions/catalog";
import { linkEmailAccount } from "@/lib/api/email-link";
import { linkWhatsAppAccount } from "@/lib/api/whatsapp-link";
import { encrypt } from "@/lib/crypto";
import { translateToUrdu, rethrowIfNextControlFlow } from "@/lib/api/response";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";

function formatError(message: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return `بھائی اس میں یہ خرابی ہے: ${translateToUrdu(message)}`;
  }
  return message;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const cityBranchSelect =
  "id,country_id,country_branch_id,city_name,name,code,local_currency,status,state_province_id,district_id,city_id,area_location_id,address,phone,email,whatsapp_number,company_id,owner_name,owner_customer_id,owner_profile_id,contacts,documents,permission_template,permission_grants,created_at,updated_at";

const cityBranchFallbackSelect =
  "id,country_id,country_branch_id,city_name,name,code,local_currency,status,state_province_id,district_id,city_id,area_location_id,address,phone,email,whatsapp_number,company_id,owner_name,owner_customer_id,owner_profile_id,contacts,documents,created_at,updated_at";

function isMissingOptionalColumn(message: string) {
  return /permission_template|permission_grants/i.test(message);
}

function normalizeCityBranchRows(rows: any[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    permission_template: row.permission_template ?? "city-standard",
    permission_grants: Array.isArray(row.permission_grants) ? row.permission_grants : [],
    ...row
  }));
}

function validatePermissionGroups(permissionGrants: string[]) {
  const allowed = new Set(allPermissionGroupKeys());
  const invalid = permissionGrants.filter((permission) => !allowed.has(permission));
  if (invalid.length) {
    throw new Error(`Invalid permission group(s): ${invalid.join(", ")}`);
  }
}

function constrainToParentPermissions(parentGrants: unknown, requestedGrants: string[]) {
  validatePermissionGroups(requestedGrants);
  const parent = Array.isArray(parentGrants) ? parentGrants.filter((permission) => typeof permission === "string") : [];
  if (!parent.length) return requestedGrants;
  const constrained = constrainChildPermissions(parent, requestedGrants);
  if (constrained.length !== requestedGrants.length) {
    const missing = requestedGrants.filter((permission) => !constrained.includes(permission));
    throw new Error(`City Branch cannot receive permissions not granted to the Main Branch: ${missing.join(", ")}`);
  }
  return constrained;
}

function buildCityBranchQuery(
  supabase: any,
  selectColumns: string,
  id: string | null,
  countryId: string | null,
  countryBranchId: string | null,
  session: Awaited<ReturnType<typeof requireErpSession>>
) {
  let query = supabase
    .from("city_branches")
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

  if (countryBranchId) {
    query = query.eq("country_branch_id", countryBranchId);
  }

  return query;
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const countryId = url.searchParams.get("countryId");
    const countryBranchId = url.searchParams.get("countryBranchId");

    // Root-cause bypass: city_branches_scope_read gates on is_super_admin()/
    // can_access_country()/can_access_city_branch(), all keyed off auth.uid(), which
    // is always NULL under the app's temp-session bootstrap login — so the "admin"
    // Supabase client below silently returns zero rows for every filtered lookup.
    // Try a direct Postgres read first (bypasses RLS via DATABASE_URL); fall back to
    // the Supabase-client path only when DATABASE_URL isn't configured.
    const viaPg = await withLocalPg(async (sql) => {
      if (id && !isUuid(id)) return { cityBranches: [] as any[] };
      if (countryId && !session.isSuperAdmin && !session.countryIds.includes(countryId)) {
        return { cityBranches: [] as any[] };
      }
      if (!countryId && !session.isSuperAdmin && session.countryIds.length === 0) {
        return { cityBranches: [] as any[] };
      }
      const rows = await sql`
        select
          id, country_id, country_branch_id, city_name, name, code, local_currency, status,
          state_province_id, district_id, city_id, area_location_id, address, phone, email,
          whatsapp_number, company_id, owner_name, owner_customer_id, owner_profile_id,
          contacts, documents, permission_template,
          permission_grants, created_at, updated_at
        from public.city_branches
        where deleted_at is null
          and (${id && isUuid(id) ? sql`id = ${id}` : sql`true`})
          and (${countryId ? sql`country_id = ${countryId}` : sql`true`})
          and (${!countryId && !session.isSuperAdmin ? sql`country_id = any(${session.countryIds})` : sql`true`})
          and (${countryBranchId ? sql`country_branch_id = ${countryBranchId}` : sql`true`})
        order by created_at asc
      `;
      return { cityBranches: normalizeCityBranchRows(rows as any[]) };
    });

    let cityBranches: any[];
    if (viaPg) {
      cityBranches = viaPg.cityBranches;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      let query = buildCityBranchQuery(supabase, cityBranchSelect, id, countryId, countryBranchId, session);
      if (!query) return NextResponse.json({ cityBranches: [] }, { status: 200 });

      let { data, error } = await query;
      if (error && isMissingOptionalColumn(error.message)) {
        const fallbackQuery = buildCityBranchQuery(supabase, cityBranchFallbackSelect, id, countryId, countryBranchId, session);
        const fallbackResult = fallbackQuery ? await fallbackQuery : { data: [], error: null };
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      cityBranches = normalizeCityBranchRows(data);
    }

    const lang = await getRequestLanguage();
    cityBranches = await localizeRecordNames(cityBranches, "city_branches", "name", lang);
    return NextResponse.json({ cityBranches }, { status: 200 });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load city branches.";
    return NextResponse.json({ error: message, cityBranches: [] }, { status: 500 });
  }
}
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof requireErpSession>> | undefined;
  try {
    session = await requireErpSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = createCityBranchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Super Admin can create everywhere. Country/Main branch roles can create under their country scope.
    if (!session.isSuperAdmin && !session.countryIds.includes(parsed.data.countryId)) {
      return NextResponse.json({ error: formatError("Country scope is not allowed.", session.isSuperAdmin) }, { status: 403 });
    }

    // Check main branch via Postgres or Supabase
    let mainBranch: { id: string; country_id: string; local_currency: string; permission_grants: any } | null = null;
    const mbViaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, country_id, local_currency, permission_grants
        from public.country_branches
        where id = ${parsed.data.countryBranchId}
          and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (mbViaPg) {
      mainBranch = mbViaPg as any;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("country_branches")
        .select("id,country_id,local_currency,permission_grants")
        .eq("id", parsed.data.countryBranchId)
        .is("deleted_at", null)
        .single();
      if (!error && data?.id) mainBranch = data;
    }

    if (!mainBranch?.id) {
      return NextResponse.json({ error: formatError("Main branch not found.", session.isSuperAdmin) }, { status: 404 });
    }

    if (String(mainBranch.country_id) !== parsed.data.countryId) {
      return NextResponse.json({ error: formatError("Main branch does not belong to selected country.", session.isSuperAdmin) }, { status: 400 });
    }

    const permissionGrants = constrainToParentPermissions(mainBranch.permission_grants, parsed.data.permissionGrants);

    const normCode = parsed.data.code.trim().toUpperCase();
    const normName = parsed.data.name.trim();
    const normCityName = (parsed.data.cityName || parsed.data.name || "").trim();

    // Check duplicate branch code under the same country
    const existingCodeId = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id from public.city_branches
        where country_id = ${parsed.data.countryId}
          and upper(code) = ${normCode}
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.id ?? null;
    });

    if (existingCodeId) {
      return NextResponse.json(
        { error: formatError(`Branch Code "${normCode}" is already in use in this country. Please specify a unique Branch Code.`, session.isSuperAdmin) },
        { status: 409 }
      );
    }

    // Check duplicate branch name in the same city
    const existingNameId = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id from public.city_branches
        where country_id = ${parsed.data.countryId}
          and lower(city_name) = lower(${normCityName})
          and lower(name) = lower(${normName})
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.id ?? null;
    });

    if (existingNameId) {
      return NextResponse.json(
        { error: formatError(`Branch Name "${normName}" already exists for this City. Please choose a distinct Branch Name.`, session.isSuperAdmin) },
        { status: 409 }
      );
    }

    let validCreatedBy: string | null = null;
    const actorUserId = session.userId;
    if (isUuid(actorUserId)) {
      const profileRow = await withLocalPg(async (sql) => {
        const rows = await sql`select id from public.profiles where id = ${actorUserId} and deleted_at is null limit 1`;
        return rows[0] ?? null;
      });
      if (profileRow?.id) {
        validCreatedBy = profileRow.id;
      }
    }

    const payload = {
      country_id: parsed.data.countryId,
      country_branch_id: parsed.data.countryBranchId,
      city_name: normCityName,
      name: normName,
      code: normCode,
      local_currency: parsed.data.currencyCode.trim().toUpperCase(),
      status: "active",
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      area_location_id: parsed.data.areaLocationId ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email.trim().toLowerCase(),
      whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
      company_id: parsed.data.companyId ?? null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      owner_customer_id: parsed.data.ownerCustomerId ?? null,
      owner_profile_id: parsed.data.ownerProfileId ?? null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: permissionGrants,
      created_by: validCreatedBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If city_id is present, prefer the canonical city name from centralized location.
    if (payload.city_id && (!payload.city_name || payload.city_name.length < 2)) {
      const cityRow = await withLocalPg(async (sql) => {
        const rows = await sql`select name from public.cities where id = ${payload.city_id} and deleted_at is null limit 1`;
        return rows[0] ?? null;
      });
      if (cityRow?.name) payload.city_name = String(cityRow.name).trim();
    }

    let insertedId: string | null = null;
    const viaPgInsert = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.city_branches (
          country_id, country_branch_id, city_name, name, code, local_currency, status,
          state_province_id, district_id, city_id, area_location_id, address, phone, email,
          whatsapp_number, company_id, owner_name, owner_customer_id, owner_profile_id,
          contacts, documents, permission_template,
          permission_grants, created_by, created_at, updated_at
        ) values (
          ${payload.country_id}, ${payload.country_branch_id}, ${payload.city_name},
          ${payload.name}, ${payload.code}, ${payload.local_currency}, ${payload.status},
          ${payload.state_province_id}, ${payload.district_id}, ${payload.city_id},
          ${payload.area_location_id}, ${payload.address}, ${payload.phone}, ${payload.email},
          ${payload.whatsapp_number}, ${payload.company_id}, ${payload.owner_name},
          ${payload.owner_customer_id}, ${payload.owner_profile_id},
          ${sql.json(payload.contacts as any)}, ${sql.json(payload.documents as any)},
          ${payload.permission_template}, ${payload.permission_grants},
          ${payload.created_by}, ${payload.created_at}, ${payload.updated_at}
        )
        returning id
      `;
      return rows[0]?.id ?? null;
    });

    if (viaPgInsert) {
      insertedId = viaPgInsert;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase.from("city_branches").insert(payload).select("id").single();
      if (error) {
        return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 403 });
      }
      insertedId = data?.id ?? null;
    }

    if (!insertedId) {
      return NextResponse.json({ error: formatError("Failed to insert city branch record.", session.isSuperAdmin) }, { status: 500 });
    }

    void syncRecordTranslations({
      table: "city_branches",
      recordId: insertedId,
      record: payload,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    }).catch(() => {});

    // Link/Upsert central email account
    const encryptedSmtpPass = parsed.data.emailServerSettings?.smtpPass
      ? encrypt(parsed.data.emailServerSettings.smtpPass)
      : undefined;

    const emailSettings = parsed.data.emailServerSettings ? {
      ...parsed.data.emailServerSettings,
      smtpPass: encryptedSmtpPass
    } : {};

    await linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: parsed.data.countryBranchId,
      cityBranchId: insertedId,
      scope: "city_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email,
      settings: emailSettings
    });

    if (parsed.data.whatsappConfig?.whatsappNumber && parsed.data.whatsappConfig?.phoneNumberId) {
      const encryptedAccessToken = parsed.data.whatsappConfig.accessToken
        ? encrypt(parsed.data.whatsappConfig.accessToken)
        : "";

      await linkWhatsAppAccount({
        countryId: parsed.data.countryId,
        countryBranchId: parsed.data.countryBranchId,
        cityBranchId: insertedId,
        scope: "city_branch",
        displayName: parsed.data.name.trim(),
        phoneNumber: parsed.data.whatsappConfig.whatsappNumber,
        phoneNumberId: parsed.data.whatsappConfig.phoneNumberId,
        wabaId: parsed.data.whatsappConfig.wabaId || "",
        accessToken: encryptedAccessToken,
        isActive: parsed.data.whatsappConfig.isActive !== false
      });
    }

    await auditApiAction(request as any, {
      action: "city_branches.create.api",
      entityTable: "city_branches",
      entityId: insertedId,
      after: payload
    });

    return NextResponse.json({ id: insertedId }, { status: 201 });
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
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Valid city branch id is required." }, { status: 400 });
    }

    const parsed = createCityBranchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!session.isSuperAdmin && !session.countryIds.includes(parsed.data.countryId)) {
      return NextResponse.json({ error: formatError("Country scope is not allowed.", session.isSuperAdmin) }, { status: 403 });
    }

    let mainBranch: { id: string; country_id: string; local_currency: string; permission_grants: any } | null = null;
    const mbViaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, country_id, local_currency, permission_grants
        from public.country_branches
        where id = ${parsed.data.countryBranchId}
          and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (mbViaPg) {
      mainBranch = mbViaPg as any;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("country_branches")
        .select("id,country_id,local_currency,permission_grants")
        .eq("id", parsed.data.countryBranchId)
        .is("deleted_at", null)
        .single();
      if (!error && data?.id) mainBranch = data;
    }

    if (!mainBranch?.id) {
      return NextResponse.json({ error: formatError("Main branch not found.", session.isSuperAdmin) }, { status: 404 });
    }

    if (String(mainBranch.country_id) !== parsed.data.countryId) {
      return NextResponse.json({ error: formatError("Main branch does not belong to selected country.", session.isSuperAdmin) }, { status: 400 });
    }

    const permissionGrants = constrainToParentPermissions(mainBranch.permission_grants, parsed.data.permissionGrants);

    const normCode = parsed.data.code.trim().toUpperCase();
    const normName = parsed.data.name.trim();
    const normCityName = (parsed.data.cityName || parsed.data.name || "").trim();

    // Check duplicate branch code excluding self
    const existingCodeId = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id from public.city_branches
        where country_id = ${parsed.data.countryId}
          and upper(code) = ${normCode}
          and id <> ${id}
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.id ?? null;
    });

    if (existingCodeId) {
      return NextResponse.json(
        { error: formatError(`Branch Code "${normCode}" is already in use in this country. Please specify a unique Branch Code.`, session.isSuperAdmin) },
        { status: 409 }
      );
    }

    // Check duplicate branch name in the same city excluding self
    const existingNameId = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id from public.city_branches
        where country_id = ${parsed.data.countryId}
          and lower(city_name) = lower(${normCityName})
          and lower(name) = lower(${normName})
          and id <> ${id}
          and deleted_at is null
        limit 1
      `;
      return rows[0]?.id ?? null;
    });

    if (existingNameId) {
      return NextResponse.json(
        { error: formatError(`Branch Name "${normName}" already exists for this City. Please choose a distinct Branch Name.`, session.isSuperAdmin) },
        { status: 409 }
      );
    }

    const payload = {
      country_id: parsed.data.countryId,
      country_branch_id: parsed.data.countryBranchId,
      city_name: normCityName,
      name: normName,
      code: normCode,
      local_currency: parsed.data.currencyCode.trim().toUpperCase(),
      status: "active",
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      area_location_id: parsed.data.areaLocationId ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email.trim().toLowerCase(),
      whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
      company_id: parsed.data.companyId ?? null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      owner_customer_id: parsed.data.ownerCustomerId ?? null,
      owner_profile_id: parsed.data.ownerProfileId ?? null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: permissionGrants,
      updated_at: new Date().toISOString()
    };

    if (payload.city_id && (!payload.city_name || payload.city_name.length < 2)) {
      const cityRow = await withLocalPg(async (sql) => {
        const rows = await sql`select name from public.cities where id = ${payload.city_id} and deleted_at is null limit 1`;
        return rows[0] ?? null;
      });
      if (cityRow?.name) payload.city_name = String(cityRow.name).trim();
    }

    let updatedId: string | null = null;
    const viaPgUpdate = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.city_branches
        set
          country_id = ${payload.country_id},
          country_branch_id = ${payload.country_branch_id},
          city_name = ${payload.city_name},
          name = ${payload.name},
          code = ${payload.code},
          local_currency = ${payload.local_currency},
          status = ${payload.status},
          state_province_id = ${payload.state_province_id},
          district_id = ${payload.district_id},
          city_id = ${payload.city_id},
          area_location_id = ${payload.area_location_id},
          address = ${payload.address},
          phone = ${payload.phone},
          email = ${payload.email},
          whatsapp_number = ${payload.whatsapp_number},
          company_id = ${payload.company_id},
          owner_name = ${payload.owner_name},
          owner_customer_id = ${payload.owner_customer_id},
          owner_profile_id = ${payload.owner_profile_id},
          contacts = ${sql.json(payload.contacts as any)},
          documents = ${sql.json(payload.documents as any)},
          permission_template = ${payload.permission_template},
          permission_grants = ${payload.permission_grants},
          updated_at = ${payload.updated_at}
        where id = ${id}
          and deleted_at is null
        returning id
      `;
      return rows[0]?.id ?? null;
    });

    if (viaPgUpdate) {
      updatedId = viaPgUpdate;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("city_branches")
        .update(payload)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .single();

      if (error) {
        return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 403 });
      }
      updatedId = data?.id ?? id;
    }

    void syncRecordTranslations({
      table: "city_branches",
      recordId: updatedId || id,
      record: payload,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    }).catch(() => {});

    // Link/Upsert central email account
    const encryptedSmtpPass = parsed.data.emailServerSettings?.smtpPass
      ? encrypt(parsed.data.emailServerSettings.smtpPass)
      : undefined;

    const emailSettings = parsed.data.emailServerSettings ? {
      ...parsed.data.emailServerSettings,
      smtpPass: encryptedSmtpPass
    } : {};

    await linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: parsed.data.countryBranchId,
      cityBranchId: id,
      scope: "city_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email,
      settings: emailSettings
    });

    if (parsed.data.whatsappConfig?.whatsappNumber && parsed.data.whatsappConfig?.phoneNumberId) {
      const encryptedAccessToken = parsed.data.whatsappConfig.accessToken
        ? encrypt(parsed.data.whatsappConfig.accessToken)
        : "";

      await linkWhatsAppAccount({
        countryId: parsed.data.countryId,
        countryBranchId: parsed.data.countryBranchId,
        cityBranchId: id,
        scope: "city_branch",
        displayName: parsed.data.name.trim(),
        phoneNumber: parsed.data.whatsappConfig.whatsappNumber,
        phoneNumberId: parsed.data.whatsappConfig.phoneNumberId,
        wabaId: parsed.data.whatsappConfig.wabaId || "",
        accessToken: encryptedAccessToken,
        isActive: parsed.data.whatsappConfig.isActive !== false
      });
    }

    await auditApiAction(request as any, {
      action: "city_branches.update.api",
      entityTable: "city_branches",
      entityId: updatedId || id,
      after: payload
    });

    return NextResponse.json({ id: updatedId || id }, { status: 200 });
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
