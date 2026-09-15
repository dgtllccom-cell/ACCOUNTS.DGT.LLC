/**
 * Server-side resolution + persistence for `invoice_template_defaults`
 * (migration 20261127). Priority (most specific wins):
 *
 *   Document Type → City Branch → Main (Country) Branch → Country → Company → global
 *
 * Implemented as a specificity SCORE per candidate row (a document-type match
 * always outweighs any geography match, then geography narrows from City
 * Branch down to global) — the highest-scoring row whose scope actually
 * applies to the caller's context wins.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_INVOICE_TEMPLATE_ID } from "@/lib/reports/invoice-templates/registry";

export type ResolveContext = {
  documentType?: string | null;
  companyId?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

export type ResolvedTemplateDefault = {
  templateId: string;
  showLogo: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  matchedScope: string | null;
};

type Row = {
  id: string;
  scope_type: "global" | "company" | "country" | "country_branch" | "city_branch";
  scope_id: string | null;
  document_type: string | null;
  template_id: string;
  show_logo: boolean;
  show_bank_details: boolean;
  show_terms: boolean;
};

const GEO_WEIGHT: Record<Row["scope_type"], number> = {
  city_branch: 8,
  country_branch: 4,
  country: 2,
  company: 1,
  global: 0,
};

function scoreRow(row: Row, ctx: ResolveContext): number {
  if (row.document_type && row.document_type !== ctx.documentType) return -1;
  const docBonus = row.document_type ? 16 : 0;
  switch (row.scope_type) {
    case "city_branch":
      return row.scope_id && row.scope_id === ctx.cityBranchId ? docBonus + GEO_WEIGHT.city_branch : -1;
    case "country_branch":
      return row.scope_id && row.scope_id === ctx.countryBranchId ? docBonus + GEO_WEIGHT.country_branch : -1;
    case "country":
      return row.scope_id && row.scope_id === ctx.countryId ? docBonus + GEO_WEIGHT.country : -1;
    case "company":
      return row.scope_id && row.scope_id === ctx.companyId ? docBonus + GEO_WEIGHT.company : -1;
    case "global":
      return docBonus + GEO_WEIGHT.global;
    default:
      return -1;
  }
}

export async function resolveInvoiceTemplateDefaultServer(ctx: ResolveContext): Promise<ResolvedTemplateDefault> {
  const fallback: ResolvedTemplateDefault = {
    templateId: DEFAULT_INVOICE_TEMPLATE_ID,
    showLogo: true,
    showBankDetails: true,
    showTerms: true,
    matchedScope: null,
  };
  try {
    const supabase = createSupabaseAdminClient();
    // `invoice_template_defaults` (migration 20261127) predates the last
    // generated Database types, so the query builder is cast — same pattern
    // used for other freshly-migrated tables (see app/api/erp/branding/route.ts).
    const { data, error } = await (supabase.from("invoice_template_defaults" as any) as any)
      .select("id, scope_type, scope_id, document_type, template_id, show_logo, show_bank_details, show_terms")
      .eq("is_active", true);
    if (error || !data || !data.length) return fallback;

    let best: Row | null = null;
    let bestScore = -1;
    for (const row of data as Row[]) {
      const s = scoreRow(row, ctx);
      if (s > bestScore) { bestScore = s; best = row; }
    }
    if (!best || bestScore < 0) return fallback;
    return {
      templateId: best.template_id,
      showLogo: best.show_logo,
      showBankDetails: best.show_bank_details,
      showTerms: best.show_terms,
      matchedScope: best.document_type ? `${best.scope_type}:${best.document_type}` : best.scope_type,
    };
  } catch {
    return fallback;
  }
}

export type SaveDefaultInput = {
  scopeType: Row["scope_type"];
  scopeId: string | null;
  documentType: string | null;
  templateId: string;
  showLogo: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  createdBy?: string | null;
};

export async function saveInvoiceTemplateDefaultServer(input: SaveDefaultInput): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const table = () => (supabase.from("invoice_template_defaults" as any) as any);
  const payload = {
    scope_type: input.scopeType,
    scope_id: input.scopeId,
    document_type: input.documentType,
    template_id: input.templateId,
    show_logo: input.showLogo,
    show_bank_details: input.showBankDetails,
    show_terms: input.showTerms,
    is_active: true,
    created_by: input.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };
  // Upsert on the same (scope_type, scope_id, document_type) tuple the unique
  // index enforces. Supabase upsert needs an explicit conflict target when it
  // isn't the primary key, so find-then-update/insert instead.
  let existingQuery = table()
    .select("id")
    .eq("scope_type", input.scopeType)
    .eq("is_active", true);
  existingQuery = input.scopeId === null ? existingQuery.is("scope_id", null) : existingQuery.eq("scope_id", input.scopeId);
  existingQuery = input.documentType === null ? existingQuery.is("document_type", null) : existingQuery.eq("document_type", input.documentType);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const { error } = await table().update(payload).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id as string };
  }
  const { data, error } = await table().insert(payload).select("id").single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}
