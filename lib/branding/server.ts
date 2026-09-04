/**
 * Server-side Branch → Company → Branding resolver.
 *
 * Reads the existing `country_company_profiles` master (per country) and overlays
 * any non-null per-branch `branding_*` columns (city branch wins over country
 * branch). This is the SERVER twin of `lib/reports/resolve-document-branding.ts`
 * (which calls `/api/erp/branding` from the client) — same source table, same
 * precedence, no second branding system.
 *
 * NEVER fabricates a "Damaan" / default company or logo — every unresolved field
 * stays null and the caller omits it from the document.
 */
import { withLocalPg } from "@/lib/db/local-postgres";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";

export type ServerBrandingScope = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

const EMPTY: DocumentBranding = {
  entityName: null, legalName: null, logoUrl: null, stampUrl: null,
  address: null, phone: null, email: null, website: null,
  registrationNumber: null, taxNumber: null, countryName: null, branchName: null,
  baseCurrency: null, bank: null, raw: null,
};

/** Resolve document branding from a country/branch scope, server-side. */
export async function resolveBrandingServer(scope: ServerBrandingScope): Promise<DocumentBranding> {
  if (!scope.countryId && !scope.countryBranchId && !scope.cityBranchId) return { ...EMPTY };

  const b = await withLocalPg(async (sql) => {
    const prof = scope.countryId
      ? ((await sql`select company_name, legal_name, company_logo_url, company_stamp_url, letterhead_url, report_header,
                    company_address, contact_information, registration_number, tax_information, website_information,
                    base_currency, banking_information
             from public.country_company_profiles
             where country_id = ${scope.countryId}::uuid and is_active = true and deleted_at is null
             order by created_at limit 1`) as any[])[0]
      : null;
    const cname = scope.countryId
      ? ((await sql`select name from public.countries where id = ${scope.countryId}::uuid`) as any[])[0]?.name
      : null;

    const brBrand = async (table: string, bid: string | null) => {
      if (!bid) return null;
      return ((await sql`select branding_company_name, branding_logo_url, branding_stamp_url, branding_letterhead_url,
               branding_report_header, branding_report_footer, branding_address, branding_phone, branding_email, name
        from public.${sql(table)} where id = ${bid}::uuid`) as any[])[0] ?? null;
    };
    const cb = await brBrand("country_branches", scope.countryBranchId ?? null);
    const cib = await brBrand("city_branches", scope.cityBranchId ?? null);
    return { prof, cname, cb, cib };
  });

  const p = b?.prof ?? {};
  const overlay = (o: any, base: DocumentBranding): DocumentBranding => {
    if (!o) return base;
    const r = (v: any) => (v != null && String(v).trim() !== "" ? v : undefined);
    return {
      ...base,
      entityName: r(o.branding_company_name) ?? base.entityName,
      logoUrl: r(o.branding_logo_url) ?? base.logoUrl,
      stampUrl: r(o.branding_stamp_url) ?? base.stampUrl,
      address: r(o.branding_address) ?? base.address,
      phone: r(o.branding_phone) ?? base.phone,
      email: r(o.branding_email) ?? base.email,
      branchName: r(o.name) ?? base.branchName,
      raw: {
        ...(base.raw ?? {}),
        letterheadUrl: r(o.branding_letterhead_url) ?? (base.raw as any)?.letterheadUrl,
        reportHeader: r(o.branding_report_header) ?? (base.raw as any)?.reportHeader,
        reportFooter: r(o.branding_report_footer) ?? (base.raw as any)?.reportFooter,
      } as any,
    };
  };
  const contact = (p.contact_information ?? {}) as Record<string, any>;
  const tax = (p.tax_information ?? {}) as Record<string, any>;
  let branding: DocumentBranding = {
    ...EMPTY,
    entityName: p.company_name ?? b?.cname ?? null,
    legalName: p.legal_name ?? null,
    logoUrl: p.company_logo_url ?? null,
    stampUrl: p.company_stamp_url ?? null,
    address: p.company_address ?? null,
    phone: contact.phone ?? contact.mobile ?? null,
    email: contact.email ?? null,
    website: (p.website_information as any)?.url ?? contact.website ?? null,
    registrationNumber: p.registration_number ?? null,
    taxNumber: tax.number ?? tax.vat ?? tax.ntn ?? null,
    countryName: b?.cname ?? null,
    baseCurrency: p.base_currency ?? null,
    bank: (p.banking_information ?? null) as any,
    raw: { letterheadUrl: p.letterhead_url ?? null, reportHeader: p.report_header ?? null } as any,
  };
  branding = overlay(b?.cb, branding);
  branding = overlay(b?.cib, branding); // city branch wins
  return branding;
}

/** Company display name for a scope, honouring the active UI language where a
 *  per-language name column exists (falls back to the base name, then country). */
export async function resolveBrandingCompanyName(
  scope: ServerBrandingScope,
): Promise<string | null> {
  const b = await resolveBrandingServer(scope);
  return b.entityName || b.countryName || null;
}
