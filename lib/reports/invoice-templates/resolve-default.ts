"use client";

/**
 * Client helper for the `/api/erp/invoice-template-defaults` resolver — used
 * by the template picker (TradeDocumentCenter) to preselect the right
 * template + display flags for the current transaction's scope, and to save
 * a new default when the user clicks "Set Default".
 */

import { apiGet, apiPost } from "@/lib/api/client";
import { DEFAULT_INVOICE_TEMPLATE_ID, INVOICE_TEMPLATES } from "./registry";
import type { InvoiceTemplateId } from "./types";

export type ResolveScope = {
  documentType?: string | null;
  companyId?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

export type ResolvedTemplateDefault = {
  templateId: InvoiceTemplateId;
  showLogo: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  matchedScope: string | null;
  /**
   * true when the saved default could not be read: the request failed, or the saved row names a template
   * this build does not have. The values returned are then the built-in fallback, not a saved choice, so the
   * picker must say so instead of presenting them as the default.
   */
  loadFailed?: boolean;
};

const BUILT_IN_DEFAULT: ResolvedTemplateDefault = {
  templateId: DEFAULT_INVOICE_TEMPLATE_ID,
  showLogo: true,
  showBankDetails: true,
  showTerms: true,
  matchedScope: null,
};

/**
 * Validate a raw resolver payload. Returns null when it cannot be applied as-is: a
 * malformed body, or a templateId that is not in the registry (rendering would then
 * silently use another template).
 */
export function normalizeTemplateDefault(raw: unknown): ResolvedTemplateDefault | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const templateId = typeof r.templateId === "string" ? r.templateId : "";
  if (!INVOICE_TEMPLATES.some((def) => def.id === templateId)) return null;
  return {
    templateId: templateId as InvoiceTemplateId,
    showLogo: r.showLogo !== false,
    showBankDetails: r.showBankDetails !== false,
    showTerms: r.showTerms !== false,
    matchedScope: typeof r.matchedScope === "string" && r.matchedScope ? r.matchedScope : null,
  };
}

export async function resolveInvoiceTemplateDefault(scope: ResolveScope): Promise<ResolvedTemplateDefault> {
  const qs = new URLSearchParams();
  if (scope.documentType) qs.set("documentType", scope.documentType);
  if (scope.companyId) qs.set("companyId", scope.companyId);
  if (scope.countryId) qs.set("countryId", scope.countryId);
  if (scope.countryBranchId) qs.set("countryBranchId", scope.countryBranchId);
  if (scope.cityBranchId) qs.set("cityBranchId", scope.cityBranchId);
  try {
    const res = await apiGet<{ default: unknown }>(`/api/erp/invoice-template-defaults?${qs.toString()}`);
    const normalized = normalizeTemplateDefault(res?.default);
    return normalized ?? { ...BUILT_IN_DEFAULT, loadFailed: true };
  } catch {
    return { ...BUILT_IN_DEFAULT, loadFailed: true };
  }
}

export type SaveScopeType = "global" | "company" | "country" | "country_branch" | "city_branch";

export async function saveInvoiceTemplateDefault(input: {
  scopeType: SaveScopeType;
  scopeId?: string | null;
  documentType?: string | null;
  templateId: InvoiceTemplateId;
  showLogo?: boolean;
  showBankDetails?: boolean;
  showTerms?: boolean;
}): Promise<void> {
  await apiPost("/api/erp/invoice-template-defaults", input);
}
