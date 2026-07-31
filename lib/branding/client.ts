"use client";

/**
 * Shared client-side branding fetcher for print / PDF / Excel / email flows.
 * Reuses the single /api/erp/branding resolver (which reads the existing
 * country_company_profiles master). Results are cached per countryId so a
 * report toolbar does not refetch on every click. NO duplicate branding
 * source — one resolver, one cache, used everywhere.
 */
export type Branding = {
  countryId?: string | null;
  countryName?: string | null;
  companyName?: string | null;
  companyNameByLang?: Record<string, string | null>;
  legalName?: string | null;
  logoUrl?: string | null;
  stampUrl?: string | null;
  letterheadUrl?: string | null;
  reportHeader?: string | null;
  certificateHeader?: string | null;
  hrManagerName?: string | null;
  hrDepartmentName?: string | null;
  watermarkText?: string | null;
  qrEnabled?: boolean;
  branchId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  footerTemplate?: any;
  headerTemplate?: any;
  baseCurrency?: string | null;
};

const cache = new Map<string, Branding | null>();

export async function fetchBranding(countryId?: string | null): Promise<Branding | null> {
  const key = countryId || "__session__";
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const qs = countryId ? `?countryId=${encodeURIComponent(countryId)}` : "";
    const res = await fetch(`/api/erp/branding${qs}`);
    const j = await res.json();
    const b: Branding | null = j?.branding ?? null;
    cache.set(key, b);
    return b;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Footer line from branding, with a safe neutral fallback (no hardcoded brand). */
export function brandingFooter(b: Branding | null, lang: string = "en"): string {
  if (!b) return "";
  const f = b.footerTemplate || {};
  const tpl = (typeof f === "object" && (f[lang] || f.text || f.en)) || null;
  if (tpl) return String(tpl);
  const bits = [b.companyName, b.address, b.phone, b.email, b.website].filter(Boolean);
  return bits.join("  •  ");
}

/** Company display name honouring the active UI language. */
export function brandingName(b: Branding | null, lang: string = "en"): string {
  if (!b) return "";
  return (b.companyNameByLang && b.companyNameByLang[lang]) || b.companyName || b.countryName || "";
}
