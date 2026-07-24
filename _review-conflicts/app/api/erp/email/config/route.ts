import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveCountryEmailConfig } from "@/lib/email/country-email-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  countryId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  countryBranchId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  cityBranchId: z.string().uuid().or(z.literal("")).transform(v => v || null).nullable().optional(),
  linkedModule: z.string().nullable().optional(),
  linkedDocumentNo: z.string().nullable().optional()
});

function firstScope<T>(values: T[]) {
  return values.length ? values[0] : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const admin = createSupabaseAdminClient();

    const scope = {
      countryId: params.countryId ?? firstScope(session.countryIds),
      countryBranchId: params.countryBranchId ?? firstScope(session.countryBranchIds),
      cityBranchId: params.cityBranchId ?? firstScope(session.cityBranchIds)
    };

    let recipientEmail: string | null = null;

    if (params.linkedModule && params.linkedDocumentNo) {
      const module = params.linkedModule.toLowerCase();
      const docNo = params.linkedDocumentNo;
      
      if (module.includes("purchase")) {
        const queryBuilder = admin.from("purchase_orders").select("country_id, country_branch_id, city_branch_id, supplier_company_id");
        const poQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("purchase_order_no", docNo);
        const { data: po } = await poQuery.maybeSingle();
        
        if (po) {
          scope.countryId = po.country_id || scope.countryId;
          scope.countryBranchId = po.country_branch_id || scope.countryBranchId;
          scope.cityBranchId = po.city_branch_id || scope.cityBranchId;
          
          if (po.supplier_company_id) {
            const { data: comp } = await admin.from("companies").select("contacts").eq("id", po.supplier_company_id).maybeSingle();
            if (comp) {
              const contacts = Array.isArray(comp.contacts) ? comp.contacts : [];
              const emailContact = contacts.find((c: any) => c.email || c.emailAddress);
              recipientEmail = emailContact?.email || emailContact?.emailAddress || null;
            }
          }
        }
      } else if (module.includes("customer")) {
        const queryBuilder = admin.from("customers").select("country_id, email");
        const custQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("customer_name", docNo);
        const { data: cust } = await custQuery.maybeSingle();
        if (cust) {
          scope.countryId = cust.country_id || scope.countryId;
          recipientEmail = cust.email || null;
        }
      } else if (module.includes("supplier")) {
        const queryBuilder = admin.from("companies").select("country_id, contacts");
        const suppQuery = docNo.match(/^[0-9a-fA-F-]{36}$/)
          ? queryBuilder.eq("id", docNo)
          : queryBuilder.eq("name", docNo);
        const { data: comp } = await suppQuery.maybeSingle();
        if (comp) {
          scope.countryId = comp.country_id || scope.countryId;
          const contacts = Array.isArray(comp.contacts) ? comp.contacts : [];
          const emailContact = contacts.find((c: any) => c.email || c.emailAddress);
          recipientEmail = emailContact?.email || emailContact?.emailAddress || null;
        }
      }
    }

    const cityBranchRes = scope.cityBranchId
      ? await admin.from("city_branches").select("id, name, code, city_name, country_id, country_branch_id, email").eq("id", scope.cityBranchId).maybeSingle()
      : { data: null, error: null };
    if (cityBranchRes.error) throw new Error(cityBranchRes.error.message);
    const cityBranch = cityBranchRes.data as any;

    const countryBranchId = scope.countryBranchId ?? cityBranch?.country_branch_id ?? null;
    const countryBranchRes = countryBranchId
      ? await admin.from("country_branches").select("id, name, code, country_id, email").eq("id", countryBranchId).maybeSingle()
      : { data: null, error: null };
    if (countryBranchRes.error) throw new Error(countryBranchRes.error.message);
    const countryBranch = countryBranchRes.data as any;

    let countryId = scope.countryId ?? cityBranch?.country_id ?? countryBranch?.country_id ?? null;

    if (!countryId && session.isSuperAdmin) {
      const defaultCountry = await admin
        .from("countries")
        .select("id")
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (defaultCountry.data) {
        countryId = defaultCountry.data.id;
      }
    }

    const countryRes = countryId
      ? await admin.from("countries").select("id, name, iso2, official_email, admin_email, email_domain, email_server_settings").eq("id", countryId).maybeSingle()
      : { data: null, error: null };
    if (countryRes.error) throw new Error(countryRes.error.message);

    const countryData = (countryRes as { data: any }).data;

    let emailAccount: any = null;

    // 1. Try city branch
    if (scope.cityBranchId) {
      const acc = await admin
        .from("erp_email_accounts")
        .select("*, provider:erp_email_providers(*)")
        .eq("city_branch_id", scope.cityBranchId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc.data) emailAccount = acc.data;
    }

    // 2. Try country branch
    if (!emailAccount && countryBranchId) {
      const acc = await admin
        .from("erp_email_accounts")
        .select("*, provider:erp_email_providers(*)")
        .eq("country_branch_id", countryBranchId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc.data) emailAccount = acc.data;
    }

    // 3. Try country
    if (!emailAccount && countryId) {
      const acc = await admin
        .from("erp_email_accounts")
        .select("*, provider:erp_email_providers(*)")
        .eq("country_id", countryId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc.data) emailAccount = acc.data;
    }

    // 4. Try global/super admin
    if (!emailAccount) {
      const acc = await admin
        .from("erp_email_accounts")
        .select("*, provider:erp_email_providers(*)")
        .eq("scope", "super_admin")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acc.data) emailAccount = acc.data;
    }

    // Fallback if no erp_email_accounts but country has official_email or settings
    if (!emailAccount && countryData?.official_email) {
      emailAccount = {
        email_address: countryData.official_email,
        display_name: countryData.name === "Pakistan" ? "Asmat & Brothers" : "DGT LLC",
        settings: countryData.email_server_settings || {}
      };
    }

    let companyName = "Asmat & Brothers";
    if (countryData?.name === "United Arab Emirates" || countryData?.name === "UAE") {
      companyName = "DGT LLC";
    }

    const sigConfig = resolveCountryEmailConfig(countryData, {
      mainBranchName: countryBranch?.name ?? null,
      mainBranchCode: countryBranch?.code ?? null,
      cityBranchName: cityBranch?.name ?? null,
      cityBranchCode: cityBranch?.code ?? null,
      cityName: cityBranch?.city_name ?? null
    });

    const settings = emailAccount?.settings || {};
    const hasPassword = Boolean(settings.smtpPass || settings.password || settings.appPassword);

    const config = emailAccount ? {
      countryId: countryId,
      countryName: countryData?.name ?? "Pakistan",
      companyId: session.userId,
      companyName,
      branchId: scope.cityBranchId ?? countryBranchId ?? countryId,
      branchName: cityBranch?.name ?? countryBranch?.name ?? (countryData?.name ? `${countryData.name} Main Branch` : "Pakistan Main Branch"),
      fromEmail: emailAccount.email_address,
      fromName: emailAccount.display_name,
      providerName: emailAccount.provider?.provider_name || (emailAccount.email_address?.includes("gmail") ? "Gmail" : "Outlook"),
      smtpHost: settings.smtpHost || (emailAccount.email_address?.includes("gmail") ? "smtp.gmail.com" : "smtp.office365.com"),
      smtpPort: settings.smtpPort || 465,
      smtpSecure: settings.smtpSecure !== undefined ? settings.smtpSecure : true,
      smtpUser: settings.smtpUser || emailAccount.email_address,
      hasPassword,
      signatureText: sigConfig.signatureText,
      signatureHtml: sigConfig.signatureHtml,
      logoUrl: sigConfig.logoUrl,
      recipientEmail
    } : null;

    return apiOk({
      config,
      scope: {
        countryId: countryData?.id ?? countryId,
        countryName: countryData?.name || "Pakistan",
        countryBranchId: countryBranch?.id ?? countryBranchId,
        countryBranchName: countryBranch?.name || null,
        cityBranchId: cityBranch?.id ?? scope.cityBranchId,
        cityBranchName: cityBranch?.name || "Chaman Branch"
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}


