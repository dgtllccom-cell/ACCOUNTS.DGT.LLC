import { NextResponse } from "next/server";
import { createCityBranchSchema } from "@/features/branch-management/validation";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { allPermissionGroupKeys, constrainChildPermissions } from "@/lib/permissions/catalog";
import { linkEmailAccount } from "@/lib/api/email-link";
import { linkWhatsAppAccount } from "@/lib/api/whatsapp-link";
import { encrypt } from "@/lib/crypto";
import { translateToUrdu } from "@/lib/api/response";

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
  "id,country_id,country_branch_id,city_name,name,code,local_currency,status,state_province_id,district_id,city_id,area_location_id,address,phone,email,whatsapp_number,company_id,owner_name,contacts,documents,permission_template,permission_grants,created_at,updated_at";

const cityBranchFallbackSelect =
  "id,country_id,country_branch_id,city_name,name,code,local_currency,status,state_province_id,district_id,city_id,area_location_id,address,phone,email,whatsapp_number,company_id,owner_name,contacts,documents,created_at,updated_at";

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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ cityBranches: normalizeCityBranchRows(data) }, { status: 200 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireErpSession();
    const parsed = createCityBranchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Super Admin can create everywhere. Country/Main branch roles can create under their country scope.
    if (!session.isSuperAdmin && !session.countryIds.includes(parsed.data.countryId)) {
      return NextResponse.json({ error: formatError("Country scope is not allowed.", session.isSuperAdmin) }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient() as any;

    const { data: mainBranch, error: mainBranchError } = await supabase
      .from("country_branches")
      .select("id,country_id,local_currency,permission_grants")
      .eq("id", parsed.data.countryBranchId)
      .is("deleted_at", null)
      .single();

    if (mainBranchError || !mainBranch?.id) {
      return NextResponse.json({ error: formatError("Main branch not found.", session.isSuperAdmin) }, { status: 404 });
    }

    if (String(mainBranch.country_id) !== parsed.data.countryId) {
      return NextResponse.json({ error: formatError("Main branch does not belong to selected country.", session.isSuperAdmin) }, { status: 400 });
    }

    const permissionGrants = constrainToParentPermissions(mainBranch.permission_grants, parsed.data.permissionGrants);

    // Prevent duplicate city branches under the same main branch for the same city.
    if (parsed.data.cityId) {
      const { data: existingByCityId } = await supabase
        .from("city_branches")
        .select("id")
        .eq("country_branch_id", parsed.data.countryBranchId)
        .eq("city_id", parsed.data.cityId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingByCityId?.id) {
        return NextResponse.json(
          { error: formatError("A City Branch already exists for this City under the selected Main Branch.", session.isSuperAdmin) },
          { status: 409 }
        );
      }
    }

    const payload = {
      country_id: parsed.data.countryId,
      country_branch_id: parsed.data.countryBranchId,
      city_name: (parsed.data.cityName ?? "").trim(),
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
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
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: permissionGrants,
      created_by: isUuid(session.userId) ? session.userId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If city_id is present, prefer the canonical city name from centralized location.
    if (payload.city_id && (!payload.city_name || payload.city_name.length < 2)) {
      const { data: cityRow } = await supabase
        .from("cities")
        .select("name")
        .eq("id", payload.city_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (cityRow?.name) payload.city_name = String(cityRow.name).trim();
    }

    const { data, error } = await supabase.from("city_branches").insert(payload).select("id").single();

    if (error) {
      return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 403 });
    }

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
      cityBranchId: data.id,
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
        cityBranchId: data.id,
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
      entityId: data?.id ?? null,
      after: payload
    });

    return NextResponse.json({ id: data?.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const isSuperAdmin = typeof session !== "undefined" && (session as any)?.isSuperAdmin;
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: formatError(msg, isSuperAdmin) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireErpSession();
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

    const supabase = createSupabaseAdminClient() as any;

    const { data: mainBranch, error: mainBranchError } = await supabase
      .from("country_branches")
      .select("id,country_id,local_currency,permission_grants")
      .eq("id", parsed.data.countryBranchId)
      .is("deleted_at", null)
      .single();

    if (mainBranchError || !mainBranch?.id) {
      return NextResponse.json({ error: formatError("Main branch not found.", session.isSuperAdmin) }, { status: 404 });
    }

    if (String(mainBranch.country_id) !== parsed.data.countryId) {
      return NextResponse.json({ error: formatError("Main branch does not belong to selected country.", session.isSuperAdmin) }, { status: 400 });
    }

    const permissionGrants = constrainToParentPermissions(mainBranch.permission_grants, parsed.data.permissionGrants);

    if (parsed.data.cityId) {
      const { data: existingByCityId } = await supabase
        .from("city_branches")
        .select("id")
        .eq("country_branch_id", parsed.data.countryBranchId)
        .eq("city_id", parsed.data.cityId)
        .neq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingByCityId?.id) {
        return NextResponse.json(
          { error: formatError("A City Branch already exists for this City under the selected Main Branch.", session.isSuperAdmin) },
          { status: 409 }
        );
      }
    }

    const payload = {
      country_id: parsed.data.countryId,
      country_branch_id: parsed.data.countryBranchId,
      city_name: (parsed.data.cityName ?? "").trim(),
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
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
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: permissionGrants,
      updated_at: new Date().toISOString()
    };

    if (payload.city_id && (!payload.city_name || payload.city_name.length < 2)) {
      const { data: cityRow } = await supabase
        .from("cities")
        .select("name")
        .eq("id", payload.city_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (cityRow?.name) payload.city_name = String(cityRow.name).trim();
    }

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
      entityId: data?.id ?? id,
      after: payload
    });

    return NextResponse.json({ id: data?.id ?? id }, { status: 200 });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const isSuperAdmin = typeof session !== "undefined" && (session as any)?.isSuperAdmin;
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: formatError(msg, isSuperAdmin) }, { status: 500 });
  }
}
