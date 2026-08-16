import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { ledgerPostingSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { ledgerService } from "@/lib/services/ledger-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      ...scope
    });

    const viaPg = await withLocalPg(async (sql) => {
      let query = sql`
        select id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency,
               opening_balance, current_balance, debit_total, credit_total, is_active, created_at, updated_at
        from public.ledgers
        where deleted_at is null
      `;

      if (!session.isSuperAdmin) {
        const cityIds = session.cityBranchIds ?? [];
        const countryBranchIds = session.countryBranchIds ?? [];
        const countryIds = session.countryIds ?? [];
        if (cityIds.length === 0 && countryBranchIds.length === 0 && countryIds.length === 0) {
          return [] as any[];
        }
        query = await sql`
          select id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency,
                 opening_balance, current_balance, debit_total, credit_total, is_active, created_at, updated_at
          from public.ledgers
          where deleted_at is null
            and (city_branch_id = any(${cityIds}) or country_branch_id = any(${countryBranchIds}) or country_id = any(${countryIds}))
            and (${scope.countryId ? sql`country_id = ${scope.countryId}` : sql`true`})
            and (${scope.countryBranchId ? sql`country_branch_id = ${scope.countryBranchId}` : sql`true`})
            and (${scope.cityBranchId ? sql`city_branch_id = ${scope.cityBranchId}` : sql`true`})
          order by code asc
          limit 100
        `;
      } else {
        query = await sql`
          select id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency,
                 opening_balance, current_balance, debit_total, credit_total, is_active, created_at, updated_at
          from public.ledgers
          where deleted_at is null
            and (${scope.countryId ? sql`country_id = ${scope.countryId}` : sql`true`})
            and (${scope.countryBranchId ? sql`country_branch_id = ${scope.countryBranchId}` : sql`true`})
            and (${scope.cityBranchId ? sql`city_branch_id = ${scope.cityBranchId}` : sql`true`})
          order by code asc
          limit 100
        `;
      }

      return query as any[];
    });

    if (!viaPg) {
      return apiOk({ ledgers: [], limit: 100 });
    }

    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    const resolvedData = await localizeRecordNames(viaPg as any[], "ledgers", "name", lang);

    return apiOk({
      ledgers: resolvedData,
      limit: 100
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = ledgerPostingSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "journal_entries",
      action: body.mode === "post" ? "post" : "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const postingPlan = ledgerService.createPostingPlan({
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId,
      entryDate: body.entryDate,
      lines: body.lines
    });

    if (body.mode === "validate") {
      return apiOk({
        mode: body.mode,
        balanced: true,
        postingPlan
      });
    }

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("post_enterprise_ledger_batch", {
      p_scope: body.scope,
      p_country_id: body.countryId ?? null,
      p_country_branch_id: body.countryBranchId ?? null,
      p_city_branch_id: body.cityBranchId ?? null,
      p_entry_date: body.entryDate,
      p_reference_no: body.referenceNo ?? null,
      p_narration: body.narration ?? null,
      p_lines: body.lines
    });

    if (error) {
      throw new Error(error.message);
    }

    const batchId = data as string;

    return apiCreated({
      mode: body.mode,
      balanced: true,
      batchId,
      postingPlan
    });
  } catch (error) {
    return handleApiError(error);
  }
}
