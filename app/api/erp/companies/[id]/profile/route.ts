import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uuidSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Company Master Profile projection — the company record plus its bank
 * relationships (banks it owns) and related accounts, for the professional
 * A4 Company Master Profile document. Scope-enforced.
 *
 *   GET /api/erp/companies/[id]/profile?lang=<code>
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "read" });

    const { id: rawId } = await context.params;
    const id = uuidSchema.parse(rawId);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    let company = await companiesService.getById(id);
    if (!company) return apiOk({ profile: null });

    for (const field of ["name", "legal_name", "owner_name", "country_name", "state_name", "city_name"]) {
      const [resolved] = await localizeRecordNames([company], "companies", field as never, lang, { phraseFallback: true });
      company = resolved;
    }

    // Non-fatal enrichment — banks owned by this company + related accounts.
    let banks: any[] = [];
    let relatedAccounts: any[] = [];
    let ownerPerson: any = null;
    let managerPerson: any = null;
    try {
      await withLocalPg(async (sql) => {
        banks = await sql`
          SELECT bank_name, branch_name, account_title, account_number, iban_number, swift_bic, currency
          FROM public.banks
          WHERE owner_company_id = ${id}::uuid AND (is_active IS NULL OR is_active = true)
          ORDER BY created_at ASC LIMIT 25
        `;
        relatedAccounts = await sql`
          SELECT a.name, a.code, l.ledger_currency AS currency, l.current_balance AS balance,
                 CASE WHEN a.is_active THEN 'Active' ELSE 'Inactive' END AS status
          FROM public.account_companies ac
          JOIN public.accounts a ON a.id = ac.account_id
          LEFT JOIN public.ledgers l ON l.account_id = a.id
          WHERE ac.company_id = ${id}::uuid
          ORDER BY a.created_at ASC LIMIT 50
        `;
        if ((company as any).owner_person_id) {
          const [p] = await sql`SELECT customer_name, national_id FROM public.customers WHERE id = ${(company as any).owner_person_id}::uuid LIMIT 1`;
          ownerPerson = p ?? null;
        }
        if ((company as any).manager_person_id) {
          const [p] = await sql`SELECT customer_name, national_id FROM public.customers WHERE id = ${(company as any).manager_person_id}::uuid LIMIT 1`;
          managerPerson = p ?? null;
        }
        return true;
      });
    } catch {
      /* enrichment is best-effort — the base company record still prints */
    }

    const owners = [
      ownerPerson?.customer_name || (company as any).owner_name
        ? { name: ownerPerson?.customer_name || (company as any).owner_name, role: "Owner", nationalId: ownerPerson?.national_id }
        : null,
      managerPerson?.customer_name
        ? { name: managerPerson.customer_name, role: "Manager / Director", nationalId: managerPerson?.national_id }
        : null,
    ].filter(Boolean);

    return apiOk({
      profile: {
        ...company,
        code: (company as any).company_code ?? null,
        main_branch_name: null,
        city_branch_name: null,
        owners,
        banks: (banks || []).map((b: any) => ({
          bankName: b.bank_name,
          accountTitle: b.account_title,
          accountNumber: b.account_number,
          iban: b.iban_number,
          swift: b.swift_bic,
          currency: b.currency,
        })),
        relatedAccounts: relatedAccounts || [],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
