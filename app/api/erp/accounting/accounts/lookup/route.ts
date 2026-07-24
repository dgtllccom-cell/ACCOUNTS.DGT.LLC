import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { getRequestLanguage } from "@/lib/i18n/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ledgerReportService, type LedgerReportScope } from "@/lib/services/ledger-report-service";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().optional(),
  cityBranchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500)
});

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function exactKeys(row: Awaited<ReturnType<typeof ledgerReportService.listLedgers>>[number]) {
  return [
    row.accountCode,
    row.rawAccountCode,
    row.manualReferenceNumber,
    row.customerNumber,
    row.ledgerCode,
    row.countrySerialNumber,
    row.branchSerialNumber
  ].map(normalize).filter(Boolean);
}

function searchableText(row: Awaited<ReturnType<typeof ledgerReportService.listLedgers>>[number]) {
  return normalize(
    [
      row.accountCode,
      row.rawAccountCode,
      row.manualReferenceNumber,
      row.customerNumber,
      row.accountName,
      row.companyName,
      row.countryName,
      row.countryBranchName,
      row.cityBranchName,
      row.stateName,
      row.cityName,
      row.countrySerialNumber,
      row.branchSerialNumber,
      row.ledgerCode,
      row.ledgerName,
      row.ledgerCurrency
    ]
      .filter(Boolean)
      .join(" ")
  );
}

async function findLedgerIdsFromAccountMaster(query: string, limit: number) {
  const supabase = createSupabaseAdminClient() as any;
  const value = query.trim();
  const likeValue = `%${value}%`;

  const customerAccountPromise = (async () => {
    const { data: customers, error } = await supabase
      .from("customers")
      .select("id")
      .or(`mobile.eq."${value}",whatsapp.eq."${value}",mobile.ilike."%${value}%",whatsapp.ilike."%${value}%"`)
      .is("deleted_at", null)
      .limit(limit);
    if (error) return { data: [], error };
    const customerIds = (customers ?? []).map((c: any) => c.id);
    if (customerIds.length === 0) return { data: [], error: null };
    return supabase
      .from("enterprise_accounts")
      .select("id")
      .in("customer_id", customerIds)
      .is("deleted_at", null)
      .limit(limit);
  })();

  const [accountNoRes, manualRefRes, customerNoRes, codeRes, nameRes, legacyCodeRes, legacyNameRes, ledgerCodeRes, ledgerNameRes, customerAccountRes] =
    await Promise.all([
      supabase
        .from("enterprise_accounts")
        .select("id")
        .ilike("account_number", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("enterprise_accounts")
        .select("id")
        .ilike("manual_reference_number", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("enterprise_accounts")
        .select("id")
        .ilike("customer_number", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("enterprise_accounts")
        .select("id")
        .ilike("code", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("enterprise_accounts")
        .select("id")
        .ilike("name", likeValue)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("accounts")
        .select("id")
        .ilike("code", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("accounts")
        .select("id")
        .ilike("name", likeValue)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("ledgers")
        .select("id")
        .ilike("code", value)
        .is("deleted_at", null)
        .limit(limit),
      supabase
        .from("ledgers")
        .select("id")
        .ilike("name", likeValue)
        .is("deleted_at", null)
        .limit(limit),
      customerAccountPromise
    ]);

  for (const res of [accountNoRes, manualRefRes, customerNoRes, codeRes, nameRes, legacyCodeRes, legacyNameRes, ledgerCodeRes, ledgerNameRes, customerAccountRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const enterpriseAccountIds = [
    ...(accountNoRes.data ?? []),
    ...(manualRefRes.data ?? []),
    ...(customerNoRes.data ?? []),
    ...(codeRes.data ?? []),
    ...(nameRes.data ?? []),
    ...(customerAccountRes.data ?? [])
  ].map((row: { id: string }) => row.id);
  const legacyAccountIds = [...(legacyCodeRes.data ?? []), ...(legacyNameRes.data ?? [])].map((row: { id: string }) => row.id);
  const ledgerIds = [...(ledgerCodeRes.data ?? []), ...(ledgerNameRes.data ?? [])].map((row: { id: string }) => row.id);

  const [enterpriseLedgerRes, legacyLedgerRes] = await Promise.all([
    enterpriseAccountIds.length
      ? supabase
          .from("ledgers")
          .select("id")
          .in("enterprise_account_id", [...new Set(enterpriseAccountIds)])
          .is("deleted_at", null)
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    legacyAccountIds.length
      ? supabase
          .from("ledgers")
          .select("id")
          .in("account_id", [...new Set(legacyAccountIds)])
          .is("deleted_at", null)
          .limit(limit)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (enterpriseLedgerRes.error) throw new Error(enterpriseLedgerRes.error.message);
  if (legacyLedgerRes.error) throw new Error(legacyLedgerRes.error.message);

  return [
    ...new Set([
      ...ledgerIds,
      ...(enterpriseLedgerRes.data ?? []).map((row: { id: string }) => row.id),
      ...(legacyLedgerRes.data ?? []).map((row: { id: string }) => row.id)
    ])
  ].slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const language = await getRequestLanguage();
    const query = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    const reportScope: LedgerReportScope = session.isSuperAdmin
      ? "super_admin"
      : query.cityBranchId || session.cityBranchIds.length
        ? "branch"
        : "country";

    const ledgers = await ledgerReportService.listLedgers({
      session,
      reportScope,
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
      limit: query.limit,
      language,
      includeAllScopes: true
    });

    const needle = normalize(query.q);
    const exact = ledgers.find((row) => exactKeys(row).includes(needle)) ?? null;
    const fuzzy = exact ?? ledgers.find((row) => searchableText(row).includes(needle)) ?? null;

    if (!fuzzy) {
      const directLedgerIds = await findLedgerIdsFromAccountMaster(query.q, query.limit);
      for (const ledgerId of directLedgerIds) {
        const directRows = await ledgerReportService.listLedgers({
          session,
          reportScope,
          ledgerId,
          countryId: query.countryId ?? null,
          countryBranchId: query.countryBranchId ?? null,
          cityBranchId: query.cityBranchId ?? null,
          limit: 1,
          language,
          includeAllScopes: true
        });
        const direct = directRows[0] ?? null;
        if (!direct) continue;
        const directExact = exactKeys(direct).includes(needle);
        if (directExact || searchableText(direct).includes(needle)) {
          return apiOk({
            found: true,
            account: direct,
            query: query.q
          });
        }
      }
    }

    return apiOk({
      found: Boolean(fuzzy),
      account: fuzzy,
      query: query.q
    });
  } catch (error) {
    return handleApiError(error);
  }
}
