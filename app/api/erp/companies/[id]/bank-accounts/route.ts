import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uuidSchema } from "@/lib/api/erp-validation";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Bank accounts OWNED by a company (owner_company_id) — the beneficiary bank
 * options for that entity's Commercial Invoice / Proforma documents.
 *
 *   GET /api/erp/companies/[id]/bank-accounts
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "read" });

    const { id: rawId } = await context.params;
    const id = uuidSchema.parse(rawId);

    let rows: any[] = [];
    try {
      rows = (await withLocalPg(async (sql) => sql`
        SELECT bank_name, branch_name, account_title, account_number, iban_number,
               swift_bic, currency, full_address
        FROM public.banks
        WHERE owner_company_id = ${id}::uuid AND (is_active IS NULL OR is_active = true)
        ORDER BY created_at ASC LIMIT 25
      `)) as any[] ?? [];
    } catch {
      const db = createSupabaseAdminClient() as any;
      const { data } = await db
        .from("banks")
        .select("bank_name, branch_name, account_title, account_number, iban_number, swift_bic, currency, full_address")
        .eq("owner_company_id", id)
        .limit(25);
      rows = data || [];
    }

    return apiOk({
      banks: rows.map((b) => ({
        bankName: b.bank_name,
        branchName: b.branch_name,
        accountTitle: b.account_title,
        accountNumber: b.account_number,
        iban: b.iban_number,
        swift: b.swift_bic,
        currency: b.currency,
        address: b.full_address,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
