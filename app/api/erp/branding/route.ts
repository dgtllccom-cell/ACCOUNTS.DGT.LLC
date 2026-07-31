import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Branding resolver — returns the correct company branding for a country, from
 * the existing country_company_profiles master (NO hardcoded/DAMAN branding).
 * Country scope: super admins may request any country; others are limited to
 * their assigned countries. Used by certificates, reports, print, PDF, etc.
 *   GET /api/erp/branding?countryId=<uuid>
 */
export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    let countryId = searchParams.get("countryId") || null;
    const cityBranchId = searchParams.get("cityBranchId") || null;
    const countryBranchId = searchParams.get("countryBranchId") || null;

    if (!countryId) countryId = session.countryIds?.[0] ?? null;
    // Enforce scope: non-super-admins can only read branding for their countries.
    if (!session.isSuperAdmin && countryId && session.countryIds?.length && !session.countryIds.includes(countryId)) {
      return NextResponse.json({ error: "Not authorized for this country's branding" }, { status: 403 });
    }
    if (!countryId) return NextResponse.json({ branding: null });

    const supabase = createSupabaseAdminClient();
    const [{ data: profile }, { data: country }] = await Promise.all([
      supabase
        .from("country_company_profiles")
        .select("id, country_id, company_name, company_name_en, company_name_ur, company_name_ar, company_name_fa, company_name_ps, legal_name, company_logo_url, company_stamp_url, letterhead_url, report_header, certificate_header, hr_manager_name, company_address, contact_information, registration_number, tax_information, email_information, website_information, document_header_template, document_footer_template, base_currency, hr_department_name, watermark_text, qr_enabled")
        .eq("country_id", countryId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("countries").select("id, name, iso2").eq("id", countryId).maybeSingle(),
    ]);

    const contact = (profile?.contact_information ?? {}) as Record<string, any>;
    const tax = (profile?.tax_information ?? {}) as Record<string, any>;
    const branding = profile
      ? {
          countryId,
          countryName: country?.name ?? null,
          companyName: profile.company_name,
          companyNameByLang: {
            en: profile.company_name_en ?? profile.company_name,
            ur: profile.company_name_ur ?? profile.company_name,
            ar: profile.company_name_ar ?? profile.company_name,
            fa: profile.company_name_fa ?? profile.company_name,
            ps: profile.company_name_ps ?? profile.company_name,
          },
          legalName: profile.legal_name,
          logoUrl: profile.company_logo_url,
          stampUrl: profile.company_stamp_url,
          letterheadUrl: profile.letterhead_url,
          reportHeader: profile.report_header,
          certificateHeader: profile.certificate_header,
          hrManagerName: profile.hr_manager_name,
          hrDepartmentName: profile.hr_department_name,
          watermarkText: profile.watermark_text,
          qrEnabled: profile.qr_enabled !== false,
          address: profile.company_address,
          phone: contact.phone ?? contact.mobile ?? null,
          email: contact.email ?? null,
          website: (profile.website_information as any)?.url ?? contact.website ?? null,
          registrationNumber: profile.registration_number,
          taxNumber: tax.number ?? tax.vat ?? tax.ntn ?? null,
          headerTemplate: profile.document_header_template ?? {},
          footerTemplate: profile.document_footer_template ?? {},
          baseCurrency: profile.base_currency,
        }
      : { countryId, countryName: country?.name ?? null, companyName: country?.name ?? null, logoUrl: null };

    // Optional per-branch override: city branch takes precedence over country branch.
    // Only NON-NULL branch branding fields overlay the country branding, so a
    // branch with no branding of its own inherits the country's — country
    // branding is never affected.
    const brandingAny = branding as Record<string, any>;
    const overlayBranch = async (table: string, id: string | null) => {
      if (!id) return;
      const { data: br } = await supabase
        .from(table)
        .select("branding_company_name, branding_logo_url, branding_stamp_url, branding_letterhead_url, branding_report_header, branding_report_footer, branding_address, branding_phone, branding_email")
        .eq("id", id)
        .maybeSingle();
      if (!br) return;
      const map: Record<string, string> = {
        branding_company_name: "companyName",
        branding_logo_url: "logoUrl",
        branding_stamp_url: "stampUrl",
        branding_letterhead_url: "letterheadUrl",
        branding_report_header: "reportHeader",
        branding_address: "address",
        branding_phone: "phone",
        branding_email: "email",
      };
      for (const [col, key] of Object.entries(map)) {
        if ((br as any)[col] != null && (br as any)[col] !== "") brandingAny[key] = (br as any)[col];
      }
      if ((br as any).branding_report_footer) brandingAny.footerTemplate = { text: (br as any).branding_report_footer };
      brandingAny.branchId = id;
    };
    await overlayBranch("country_branches", countryBranchId);
    await overlayBranch("city_branches", cityBranchId); // city wins if both provided

    return NextResponse.json({ branding });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
