import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  emailAddress: z.string().email(),
  displayName: z.string().min(1),
  countryId: z.string().uuid(),
  countryBranchId: z.string().uuid().nullable().optional(),
  cityBranchId: z.string().uuid().nullable().optional(),
  scope: z.enum(["country", "country_branch", "city_branch", "super_admin"]).default("city_branch"),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpSecure: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false)
});

const updateSchema = z.object({
  id: z.string().uuid(),
  emailAddress: z.string().email().optional(),
  displayName: z.string().min(1).optional(),
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().nullable().optional(),
  cityBranchId: z.string().uuid().nullable().optional(),
  scope: z.enum(["country", "country_branch", "city_branch", "super_admin"]).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

async function resolveProviderId(admin: any, emailAddress: string) {
  const domain = emailAddress.split("@")[1] || "dgt.llc";
  const { data: provider } = await admin
    .from("erp_email_providers")
    .select("id")
    .eq("domain", domain)
    .is("deleted_at", null)
    .maybeSingle();
  if (provider?.id) return provider.id;

  const { data: fallback } = await admin
    .from("erp_email_providers")
    .select("id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return fallback?.id || null;
}

/** GET — List all email accounts for Super Admin dashboard */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;

    const { data: accounts, error } = await admin
      .from("erp_email_accounts")
      .select(`
        id, email_address, display_name, scope, is_active, is_default,
        settings, created_at, updated_at,
        last_tested_at, last_test_result, last_sent_at,
        country_id, country_branch_id, city_branch_id,
        provider:erp_email_providers(id, provider_name, domain)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch lookup tables
    const [countriesRes, countryBranchesRes, cityBranchesRes, companiesRes] = await Promise.all([
      admin.from("countries").select("id, name, iso2").order("name"),
      admin.from("country_branches").select("id, name, code, country_id").order("name"),
      admin.from("city_branches").select("id, name, code, city_name, country_id, country_branch_id").order("city_name"),
      admin.from("companies").select("id, name").order("name")
    ]);

    const countryMap = new Map((countriesRes.data || []).map((c: any) => [c.id, c]));
    const countryBranchMap = new Map((countryBranchesRes.data || []).map((b: any) => [b.id, b]));
    const cityBranchMap = new Map((cityBranchesRes.data || []).map((b: any) => [b.id, b]));

    // Resolve company for each country
    function resolveCompanyName(countryName: string | null) {
      if (!countryName) return "DGT LLC";
      if (countryName === "Pakistan") return "Asmat & Brothers";
      return "DGT LLC";
    }

    const rows = (accounts || []).map((acc: any) => {
      const settings = acc.settings || {};
      const country = acc.country_id ? countryMap.get(acc.country_id) : null;
      const countryBranch = acc.country_branch_id ? countryBranchMap.get(acc.country_branch_id) : null;
      const cityBranch = acc.city_branch_id ? cityBranchMap.get(acc.city_branch_id) : null;

      const hasPassword = Boolean(settings.smtpPass || settings.password || settings.appPassword);
      const hasHost = Boolean(settings.smtpHost || settings.host);
      const hasUser = Boolean(settings.smtpUser || acc.email_address);

      let smtpStatus = "⚪ Not Configured";
      let emailStatus = "❌ Not Ready";

      if (hasPassword && hasHost && hasUser) {
        if (acc.last_test_result === "success") {
          smtpStatus = "🟢 Connected";
          emailStatus = acc.is_active ? "✅ Ready" : "⏸️ Inactive";
        } else if (acc.last_test_result && acc.last_test_result !== "success") {
          smtpStatus = "🔴 Failed";
          emailStatus = "❌ Not Ready";
        } else {
          smtpStatus = acc.is_active ? "🟡 Not Tested" : "⏸️ Inactive";
          emailStatus = acc.is_active ? "⚠️ Needs Test" : "⏸️ Inactive";
        }
      } else if (hasHost) {
        smtpStatus = "🟡 Incomplete";
        emailStatus = "❌ Not Ready";
      }

      return {
        id: acc.id,
        emailAddress: acc.email_address,
        displayName: acc.display_name,
        scope: acc.scope,
        isActive: acc.is_active,
        isDefault: acc.is_default,
        countryId: acc.country_id,
        countryName: country?.name || null,
        countryIso2: country?.iso2 || null,
        countryBranchId: acc.country_branch_id,
        countryBranchName: countryBranch?.name || null,
        cityBranchId: acc.city_branch_id,
        cityBranchName: cityBranch?.name || null,
        companyName: resolveCompanyName(country?.name),
        providerName: acc.provider?.provider_name || (acc.email_address?.includes("gmail") ? "Gmail" : "Outlook"),
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || "",
        smtpUser: settings.smtpUser || acc.email_address || "",
        smtpSecure: settings.smtpSecure !== undefined ? settings.smtpSecure : true,
        hasPassword,
        smtpStatus,
        emailStatus,
        lastTestedAt: acc.last_tested_at,
        lastTestResult: acc.last_test_result,
        lastSentAt: acc.last_sent_at,
        createdAt: acc.created_at,
        updatedAt: acc.updated_at
      };
    });

    // Summary stats
    const summary = {
      total: rows.length,
      active: rows.filter((r: any) => r.isActive).length,
      connected: rows.filter((r: any) => r.smtpStatus.includes("Connected")).length,
      failed: rows.filter((r: any) => r.smtpStatus.includes("Failed") || r.smtpStatus.includes("Incomplete") || r.smtpStatus.includes("Not Configured")).length
    };

    return apiOk({
      accounts: rows,
      summary,
      countries: countriesRes.data || [],
      countryBranches: countryBranchesRes.data || [],
      cityBranches: cityBranchesRes.data || [],
      companies: companiesRes.data || []
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — Create a new email account */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = createSchema.parse(await request.json());
    const admin = createSupabaseAdminClient() as any;

    const providerId = await resolveProviderId(admin, body.emailAddress);

    const settings = {
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpUser: body.smtpUser,
      smtpPass: encrypt(body.smtpPass),
      smtpSecure: body.smtpSecure
    };

    const payload = {
      email_address: body.emailAddress.trim().toLowerCase(),
      display_name: body.displayName.trim(),
      country_id: body.countryId,
      country_branch_id: body.countryBranchId || null,
      city_branch_id: body.cityBranchId || null,
      provider_id: providerId,
      scope: body.scope,
      settings,
      is_active: body.isActive,
      is_default: body.isDefault,
      cc_super_admin: true,
      cc_country_admin: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: created, error } = await admin
      .from("erp_email_accounts")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return apiCreated({ id: created.id, message: "Email account created successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT — Update an existing email account */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = updateSchema.parse(await request.json());
    const admin = createSupabaseAdminClient() as any;

    // Fetch existing record
    const { data: existing, error: fetchError } = await admin
      .from("erp_email_accounts")
      .select("id, settings, email_address")
      .eq("id", body.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Email account not found." } }, { status: 404 });
    }

    const currentSettings = existing.settings || {};
    const newSettings = { ...currentSettings };

    if (body.smtpHost !== undefined) newSettings.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) newSettings.smtpPort = body.smtpPort;
    if (body.smtpUser !== undefined) newSettings.smtpUser = body.smtpUser;
    if (body.smtpSecure !== undefined) newSettings.smtpSecure = body.smtpSecure;
    if (body.smtpPass !== undefined && body.smtpPass.length > 0) {
      newSettings.smtpPass = encrypt(body.smtpPass);
    }

    const updatePayload: any = {
      settings: newSettings,
      updated_at: new Date().toISOString()
    };

    if (body.emailAddress !== undefined) {
      updatePayload.email_address = body.emailAddress.trim().toLowerCase();
      updatePayload.provider_id = await resolveProviderId(admin, body.emailAddress);
    }
    if (body.displayName !== undefined) updatePayload.display_name = body.displayName.trim();
    if (body.countryId !== undefined) updatePayload.country_id = body.countryId;
    if (body.countryBranchId !== undefined) updatePayload.country_branch_id = body.countryBranchId || null;
    if (body.cityBranchId !== undefined) updatePayload.city_branch_id = body.cityBranchId || null;
    if (body.scope !== undefined) updatePayload.scope = body.scope;
    if (body.isActive !== undefined) updatePayload.is_active = body.isActive;
    if (body.isDefault !== undefined) updatePayload.is_default = body.isDefault;

    const { error: updateError } = await admin
      .from("erp_email_accounts")
      .update(updatePayload)
      .eq("id", body.id);

    if (updateError) throw new Error(updateError.message);

    return apiOk({ id: body.id, message: "Email account updated successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — Soft-delete an email account */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_ID", message: "Account ID is required." } }, { status: 400 });
    }

    const admin = createSupabaseAdminClient() as any;
    const { error } = await admin
      .from("erp_email_accounts")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return apiOk({ id, message: "Email account deleted." });
  } catch (error) {
    return handleApiError(error);
  }
}
