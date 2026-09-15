"use client";

/**
 * Client helper for the `/api/erp/invoice-template-defaults` resolver — used
 * by the template picker (TradeDocumentCenter) to preselect the right
 * template + display flags for the current transaction's scope, and to save
 * a new default when the user clicks "Set Default".
 */

import { apiGet, apiPost } from "@/lib/api/client";
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
};

export async function resolveInvoiceTemplateDefault(scope: ResolveScope): Promise<ResolvedTemplateDefault> {
  const qs = new URLSearchParams();
  if (scope.documentType) qs.set("documentType", scope.documentType);
  if (scope.companyId) qs.set("companyId", scope.companyId);
  if (scope.countryId) qs.set("countryId", scope.countryId);
  if (scope.countryBranchId) qs.set("countryBranchId", scope.countryBranchId);
  if (scope.cityBranchId) qs.set("cityBranchId", scope.cityBranchId);
  try {
    const res = await apiGet<{ default: ResolvedTemplateDefault }>(`/api/erp/invoice-template-defaults?${qs.toString()}`);
    return res.default;
  } catch {
    return { templateId: "classic", showLogo: true, showBankDetails: true, showTerms: true, matchedScope: null };
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
