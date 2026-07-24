import { NextResponse } from "next/server";
import { createCountrySchema } from "@/features/branch-management/validation";
import { requireErpSession } from "@/lib/auth/session";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { linkEmailAccount } from "@/lib/api/email-link";

export async function GET() {
  const session = await requireErpSession();
  const supabase = createSupabaseAdminClient() as any;

  let query = supabase
    .from("countries")
    .select(
      "id,name,iso2,iso3,currency_code,default_language_code,default_country_branch_id,parent_business_group_id,default_company_profile_id,official_email,admin_email,whatsapp_number,email_domain,email_server_settings,created_at"
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (!session.isSuperAdmin) {
    // Non-super-admins can only see assigned countries.
    query = query.in("id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ countries: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await requireErpSession();
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: "Only Super Admin can create countries." }, { status: 403 });
  }

  const parsed = createCountrySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient() as any;
  const payload = {
    name: parsed.data.name.trim(),
    iso2: parsed.data.iso2 ? parsed.data.iso2.trim().toUpperCase() : null,
    iso3: parsed.data.iso3 ? parsed.data.iso3.trim().toUpperCase() : null,
    currency_code: parsed.data.currencyCode.trim().toUpperCase(),
    parent_business_group_id: parsed.data.parentBusinessGroupId ?? null,
    official_email: parsed.data.officialEmail.trim().toLowerCase(),
    admin_email: parsed.data.adminEmail.trim().toLowerCase(),
    whatsapp_number: parsed.data.whatsappNumber?.trim() || null,
    email_domain: parsed.data.emailDomain?.trim() || null,
    email_server_settings: parsed.data.emailServerSettings ?? {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("countries")
    .insert(payload)
    .select("id, name, official_email, admin_email")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Link/Upsert central email accounts
  await linkEmailAccount({
    countryId: data.id,
    scope: "country",
    displayName: `${data.name} Official`,
    emailAddress: data.official_email,
    adminEmail: data.admin_email
  });

  // Country company branding is additive and optional during rollout. If the
  // new branding migration is not applied yet, country creation must still work.
  try {
    const now = new Date().toISOString();
    const { data: group } = await supabase
      .from("parent_business_groups")
      .select("id")
      .eq("is_default", true)
      .is("deleted_at", null)
      .maybeSingle();

    const countryCompanyProfile = {
      country_id: data?.id,
      parent_business_group_id: parsed.data.parentBusinessGroupId ?? group?.id ?? null,
      company_name: parsed.data.companyName?.trim() || parsed.data.name.trim(),
      company_logo_url: parsed.data.companyLogoUrl?.trim() || null,
      company_address: parsed.data.companyAddress?.trim() || null,
      contact_information: parsed.data.contactInformation ?? {},
      registration_number: parsed.data.registrationNumber?.trim() || null,
      tax_information: parsed.data.taxInformation ?? {},
      banking_information: parsed.data.bankingInformation ?? {},
      email_information: parsed.data.emailInformation ?? {},
      website_information: parsed.data.websiteInformation ?? {},
      base_currency: parsed.data.currencyCode.trim().toUpperCase(),
      is_active: true,
      created_by: session.userId,
      created_at: now,
      updated_at: now
    };

    const { data: profile } = await supabase
      .from("country_company_profiles")
      .insert(countryCompanyProfile)
      .select("id")
      .single();

    if (profile?.id) {
      await supabase
        .from("countries")
        .update({
          parent_business_group_id: countryCompanyProfile.parent_business_group_id,
          default_company_profile_id: profile.id,
          updated_at: now
        })
        .eq("id", data?.id);
    }
  } catch {
    // Branding tables may not exist until migration 0019 is applied.
  }

  await auditApiAction(request as any, {
    action: "countries.create.api",
    entityTable: "countries",
    entityId: data?.id ?? null,
    after: payload
  });

  return NextResponse.json({ id: data?.id }, { status: 201 });
}
