import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { ledgerScopeSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ledgerReportService, type LedgerReportScope } from "@/lib/services/ledger-report-service";
import { getRequestLanguage } from "@/lib/i18n/server";

const querySchema = z.object({
  reportScope: z.enum(["super_admin", "country", "branch"]).default("super_admin"),
  q: z.string().trim().max(200).optional(),
  scope: ledgerScopeSchema.optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(3000).default(250)
});

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const urlLang = request.nextUrl.searchParams.get("language");
    const language = urlLang || (await getRequestLanguage());
    const query = querySchema.parse({
      reportScope: request.nextUrl.searchParams.get("reportScope") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      scope: request.nextUrl.searchParams.get("scope") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const ledgers = await ledgerReportService.listLedgers({
      session,
      reportScope: query.reportScope as LedgerReportScope,
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
      limit: query.limit,
      language
    });

    // Optional hard filter: DB "scope" (super_admin/country/main_branch/city_branch).
    let filtered = query.scope ? ledgers.filter((row) => row.scope === query.scope) : ledgers;

    // Optional search (server-side convenience): ledger/account/company/location keywords.
    const qText = normalizeForSearch(query.q ?? "");
    if (qText) {
      filtered = filtered.filter((row) => {
        const hay = normalizeForSearch(
          [
            row.ledgerCode,
            row.ledgerName,
            row.accountCode,
            row.rawAccountCode,
            row.manualReferenceNumber,
            row.customerNumber,
            row.countrySerialNumber,
            row.branchSerialNumber,
            row.accountName,
            row.companyName,
            row.countryName,
            row.stateName,
            row.cityName,
            row.countryBranchName,
            row.cityBranchName,
            row.address,
            row.ledgerCurrency,
            row.accountKind
          ]
            .filter(Boolean)
            .join(" ")
        );
        return hay.includes(qText);
      });
    }

    return apiOk({
      reportScope: query.reportScope,
      filters: {
        scope: query.scope ?? null,
        countryId: query.countryId ?? null,
        countryBranchId: query.countryBranchId ?? null,
        cityBranchId: query.cityBranchId ?? null
      },
      ledgers: filtered,
      limit: query.limit
    });
  } catch (error) {
    return handleApiError(error);
  }
}
