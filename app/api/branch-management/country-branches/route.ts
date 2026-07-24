import { NextResponse } from "next/server";
import { createCountryBranchSchema } from "@/features/branch-management/validation";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { allPermissionGroupKeys } from "@/lib/permissions/catalog";
import { linkEmailAccount } from "@/lib/api/email-link";
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

const countryBranchSelect =
  "id,country_id,name,code,local_currency,is_main,status,state_province_id,district_id,city_id,address,phone,email,whatsapp_number,company_id,owner_name,contacts,documents,permission_template,permission_grants,created_at,updated_at";

const countryBranchFallbackSelect =
  "id,country_id,name,code,local_currency,is_main,status,state_province_id,district_id,city_id,address,phone,email,whatsapp_number,company_id,owner_name,contacts,documents,created_at,updated_at";

function isMissingOptionalColumn(message: string) {
  return /permission_template|permission_grants/i.test(message);
}

function normalizeCountryBranchRows(rows: any[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    permission_template: row.permission_template ?? "country-standard",
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

function buildCountryBranchQuery(
  supabase: any,
  selectColumns: string,
  id: string | null,
  countryId: string | null,
  session: Awaited<ReturnType<typeof requireErpSession>>
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

  return query;
}

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const countryId = url.searchParams.get("countryId");

    const supabase = createSupabaseAdminClient() as any;
    let query = buildCountryBranchQuery(supabase, countryBranchSelect, id, countryId, session);
    if (!query) return NextResponse.json({ countryBranches: [] }, { status: 200 });

    let { data, error } = await query;
    if (error && isMissingOptionalColumn(error.message)) {
      const fallbackQuery = buildCountryBranchQuery(supabase, countryBranchFallbackSelect, id, countryId, session);
      const fallbackResult = fallbackQuery ? await fallbackQuery : { data: [], error: null };
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ countryBranches: normalizeCountryBranchRows(data) }, { status: 200 });
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
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Only Super Admin can create country main branches." }, { status: 403 });
    }

    const parsed = createCountryBranchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient() as any;
    validatePermissionGroups(parsed.data.permissionGrants);

    const { data: country, error: countryError } = await supabase
      .from("countries")
      .select("currency_code")
      .eq("id", parsed.data.countryId)
      .is("deleted_at", null)
      .single();

    if (countryError || !country?.currency_code) {
      return NextResponse.json({ error: "Country not found." }, { status: 404 });
    }

    const { data: existingMainBranch, error: existingMainBranchError } = await supabase
      .from("country_branches")
      .select("id,country_id,name,code,local_currency,is_main,status,state_province_id,city_id,address,company_id,owner_name,created_at")
      .eq("country_id", parsed.data.countryId)
      .eq("is_main", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingMainBranchError) {
      return NextResponse.json({ error: existingMainBranchError.message }, { status: 403 });
    }

    if (existingMainBranch?.id) {
      return NextResponse.json(
        {
          error: formatError(
            "A main branch already exists for this country. Select this existing main branch when creating city branches, or choose another country to create its main branch.",
            session.isSuperAdmin
          ),
          existingBranch: existingMainBranch
        },
        { status: 409 }
      );
    }

    const payload = {
      country_id: parsed.data.countryId,
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
      local_currency: String(country.currency_code).trim().toUpperCase(),
      is_main: true,
      status: "active",
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email.trim().toLowerCase(),
      whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
      company_id: parsed.data.companyId ?? null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: parsed.data.permissionGrants,
      created_by: isUuid(session.userId) ? session.userId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from("country_branches").insert(payload).select("id").single();

    if (error) {
      return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 403 });
    }

    // Link/Upsert central email account
    await linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: data.id,
      scope: "country_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email
    });

    await auditApiAction(request as any, {
      action: "country_branches.create.api",
      entityTable: "country_branches",
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

    const supabase = createSupabaseAdminClient() as any;
    validatePermissionGroups(parsed.data.permissionGrants);

    const { data: country, error: countryError } = await supabase
      .from("countries")
      .select("currency_code")
      .eq("id", parsed.data.countryId)
      .is("deleted_at", null)
      .single();

    if (countryError || !country?.currency_code) {
      return NextResponse.json({ error: "Country not found." }, { status: 404 });
    }

    const { data: duplicateMainBranch, error: duplicateError } = await supabase
      .from("country_branches")
      .select("id")
      .eq("country_id", parsed.data.countryId)
      .eq("is_main", true)
      .neq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 403 });
    }

    if (duplicateMainBranch?.id) {
      return NextResponse.json(
        { error: "A main branch already exists for this country. Edit the existing main branch instead." },
        { status: 409 }
      );
    }

    const payload = {
      country_id: parsed.data.countryId,
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toUpperCase(),
      local_currency: String(country.currency_code).trim().toUpperCase(),
      is_main: true,
      status: "active",
      state_province_id: parsed.data.stateProvinceId ?? null,
      district_id: parsed.data.districtId ?? null,
      city_id: parsed.data.cityId ?? null,
      address: parsed.data.address?.trim() ? parsed.data.address.trim() : null,
      phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
      email: parsed.data.email.trim().toLowerCase(),
      whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
      company_id: parsed.data.companyId ?? null,
      owner_name: parsed.data.ownerName?.trim() ? parsed.data.ownerName.trim() : null,
      contacts: parsed.data.contacts ?? [],
      documents: parsed.data.documents ?? [],
      permission_template: parsed.data.permissionTemplate ?? null,
      permission_grants: parsed.data.permissionGrants,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("country_branches")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: formatError(error.message, session.isSuperAdmin) }, { status: 403 });
    }

    // Link/Upsert central email account
    await linkEmailAccount({
      countryId: parsed.data.countryId,
      countryBranchId: id,
      scope: "country_branch",
      displayName: parsed.data.name.trim(),
      emailAddress: parsed.data.email
    });

    await auditApiAction(request as any, {
      action: "country_branches.update.api",
      entityTable: "country_branches",
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
