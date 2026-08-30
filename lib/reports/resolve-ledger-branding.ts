"use client";

/**
 * Resolve DYNAMIC branding for a ledger / roznamcha statement from the record's
 * own country / branch scope (via the shared `/api/erp/branding` resolver that
 * reads `country_company_profiles`). Replaces the old hard-coded
 * "Damaan General Trading LLC" fallback across the ledger report screens — the
 * printed entity is now whatever the statement's own country/branch profile
 * carries, and missing lines are simply omitted (never a fake brand).
 */

import { resolveDocumentBranding } from "@/lib/reports/resolve-document-branding";
import type { ERPCompanyInfo } from "@/lib/reports/erp-report-template-builder";

export type LedgerScopeLike = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  countryName?: string | null;
  countryBranchName?: string | null;
  cityBranchName?: string | null;
  companyName?: string | null;
  address?: string | null;
};

export type ResolvedLedgerBranding = {
  /** The entity to print as the statement issuer (null → header omits the name line). */
  entityName: string | null;
  countryName: string | null;
  branchName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  /** Ready to spread into `openUniversalPrintReport({ companyInfo })`. */
  companyInfo: ERPCompanyInfo;
};

export async function resolveLedgerBranding(
  header: LedgerScopeLike | null | undefined,
  lang: string = "en",
  printedBy?: string | null,
): Promise<ResolvedLedgerBranding> {
  const branchName =
    header?.cityBranchName || header?.countryBranchName || null;

  const b = await resolveDocumentBranding(
    {
      countryId: header?.countryId ?? null,
      countryBranchId: header?.countryBranchId ?? null,
      cityBranchId: header?.cityBranchId ?? null,
      countryName: header?.countryName ?? null,
      branchName,
    },
    lang,
  );

  const entityName =
    b.entityName || cleanName(header?.companyName) || b.countryName || header?.countryName || null;
  const countryName = b.countryName || header?.countryName || null;
  const resolvedBranch = b.branchName || branchName || null;
  const address = b.address || cleanName(header?.address) || null;

  const companyInfo: ERPCompanyInfo = {};
  if (entityName) companyInfo.name = entityName;
  if (b.logoUrl) companyInfo.logoUrl = b.logoUrl;
  if (address) companyInfo.address = address;
  if (b.phone) companyInfo.phone = b.phone;
  if (b.email) companyInfo.email = b.email;
  if (b.website) companyInfo.website = b.website;
  if (countryName) companyInfo.country = countryName;
  if (resolvedBranch) companyInfo.branch = resolvedBranch;
  if (b.baseCurrency) companyInfo.currency = b.baseCurrency;
  const by = cleanName(printedBy);
  if (by) companyInfo.printedBy = by;

  return {
    entityName,
    countryName,
    branchName: resolvedBranch,
    registrationNumber: b.registrationNumber || null,
    taxNumber: b.taxNumber || null,
    companyInfo,
  };
}

function cleanName(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s || /^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$|todo$)/i.test(s)) return null;
  return s;
}
