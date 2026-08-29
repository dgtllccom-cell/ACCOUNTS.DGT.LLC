"use client";

/**
 * Document branding resolver (spec D).
 *
 * Every professional document (Master Profile report, Commercial Invoice,
 * Packing List, Proforma Invoice) resolves its header/footer branding from the
 * SAME source: the record's operating entity → country → branch, via the
 * existing `/api/erp/branding` resolver (`country_company_profiles` + per-branch
 * overlay, scope-enforced).
 *
 *   Transaction / Master record
 *     → cityBranchId ? use it
 *     → else countryBranchId
 *     → else countryId
 *     → else the caller's session country (handled server-side)
 *
 * There is NO hardcoded Damaan fallback. When a field is not configured it is
 * simply omitted from the document (callers pre-filter with `brandLinesFor`).
 */

import { fetchBranding, type Branding } from "@/lib/branding/client";

export type DocumentBranding = {
  entityName: string | null;
  legalName: string | null;
  logoUrl: string | null;
  stampUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  countryName: string | null;
  branchName: string | null;
  baseCurrency: string | null;
  /** raw resolver payload for callers that need extra fields */
  raw: Branding | null;
};

export type BrandingScope = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  /** display-only fallback names when the profile record has none */
  countryName?: string | null;
  branchName?: string | null;
};

const EMPTY: DocumentBranding = {
  entityName: null, legalName: null, logoUrl: null, stampUrl: null,
  address: null, phone: null, email: null, website: null,
  registrationNumber: null, taxNumber: null, countryName: null,
  branchName: null, baseCurrency: null, raw: null,
};

/** Ignore config-placeholder junk sometimes typed into the profile record. */
function real(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$|todo$|placeholder\b|not\s+set$|not\s+configured$)/i.test(s)) return null;
  return s;
}

export async function resolveDocumentBranding(
  scope: BrandingScope,
  lang: string = "en",
): Promise<DocumentBranding> {
  let b: Branding | null = null;
  try {
    // The API accepts countryId + optional branch ids and overlays branch branding.
    const qs = new URLSearchParams();
    if (scope.countryId) qs.set("countryId", scope.countryId);
    if (scope.countryBranchId) qs.set("countryBranchId", scope.countryBranchId);
    if (scope.cityBranchId) qs.set("cityBranchId", scope.cityBranchId);
    if (scope.countryId || scope.countryBranchId || scope.cityBranchId) {
      const res = await fetch(`/api/erp/branding?${qs.toString()}`);
      const j = await res.json().catch(() => ({}));
      b = (j?.branding as Branding) ?? null;
    } else {
      b = await fetchBranding(null);
    }
  } catch {
    b = null;
  }

  if (!b) {
    return {
      ...EMPTY,
      countryName: real(scope.countryName),
      branchName: real(scope.branchName),
    };
  }

  const nameByLang = (b.companyNameByLang && (b.companyNameByLang[lang] || b.companyNameByLang.en)) || null;
  return {
    entityName: real(nameByLang) || real(b.companyName) || real(b.countryName),
    legalName: real(b.legalName),
    logoUrl: real(b.logoUrl),
    stampUrl: real(b.stampUrl),
    address: real(b.address),
    phone: real(b.phone),
    email: real(b.email),
    website: real(b.website),
    registrationNumber: real(b.registrationNumber),
    taxNumber: real(b.taxNumber),
    countryName: real(b.countryName) || real(scope.countryName),
    branchName: real(scope.branchName),
    baseCurrency: real(b.baseCurrency),
    raw: b,
  };
}

/** The 1–3 branding lines shown under the entity name in a document header. */
export function brandLinesFor(b: DocumentBranding): string[] {
  const contact = [b.phone, b.email, b.website].filter(Boolean).join("  •  ");
  const ids = [
    b.registrationNumber ? `Reg: ${b.registrationNumber}` : null,
    b.taxNumber ? `Tax/TRN: ${b.taxNumber}` : null,
  ].filter(Boolean).join("   ");
  return [b.address, contact || null, ids || null].filter((x): x is string => Boolean(x));
}
