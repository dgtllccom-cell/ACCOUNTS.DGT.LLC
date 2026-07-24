import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { ledgerScopeSchema, supportedLanguageSchema, uuidSchema } from "@/lib/api/erp-validation";
import { multilingualService } from "@/lib/services/multilingual-service";

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  scope: ledgerScopeSchema.optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  status: z.enum(["all", "active", "archived"]).default("all"),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(1000),
  language: supportedLanguageSchema.default("en")
});

type EnterpriseAccountRow = {
  id: string;
  scope: "super_admin" | "country" | "main_branch" | "city_branch";
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  parent_id: string | null;
  customer_id: string | null;
  company_id: string | null;
  bank_id: string | null;
  code: string;
  account_number: string | null;
  customer_number: string | null;
  account_serial_number: string | number | null;
  country_serial_number: string | null;
  branch_serial_number: string | null;
  manual_reference_number: string | null;
  creation_date: string | null;
  branch_code: string | null;
  branch_account_sequence: string | number | null;
  name: string;
  kind: "asset" | "liability" | "equity" | "income" | "expense";
  currency: string;
  opening_balance: string | number;
  current_balance: string | number;
  status: "active" | "archived";
  is_control_account: boolean;
  contacts?: Array<{ type: string; value: string }>;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: string;
  enterprise_account_id: string | null;
  parent_ledger_id: string | null;
  code: string;
  name: string;
  currency: string;
  opening_balance: string | number;
  current_balance: string | number;
  debit_total: string | number | null;
  credit_total: string | number | null;
  normal_balance: "debit" | "credit" | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type PostingLineRow = {
  enterprise_account_id: string | null;
  ledger_id: string | null;
  batch_id: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  usd_rate: string | number;
  usd_amount: string | number;
  created_at: string;
};

type PostingBatchRow = {
  id: string;
  reference_no: string | null;
  entry_date: string;
  status: string | null;
  created_at: string;
};

type RoznamchaLineRow = {
  enterprise_account_id: string | null;
  ledger_id: string | null;
  roznamcha_entry_id: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  usd_rate: string | number;
  usd_amount: string | number;
};

type RoznamchaEntryRow = {
  id: string;
  voucher_no: string | null;
  entry_date: string;
  status: string | null;
  created_at: string;
};

type AuditRow = {
  entity_id: string | null;
  entity_table: string;
  action: string;
  created_at: string;
};

function toNumber(value: string | number | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function titleCase(input: string) {
  return input
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scopeLabel(scope: EnterpriseAccountRow["scope"]) {
  if (scope === "super_admin") return "Super Admin";
  if (scope === "country") return "Country";
  if (scope === "main_branch") return "Main Branch";
  return "City Branch";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIdPrefix(id: string | null | undefined) {
  if (!id) return "-";
  return id.slice(0, 8).toUpperCase();
}

function latestByDate<T extends { created_at: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

type TranslationRow = {
  record_table: string;
  record_id: string;
  field_name: string;
  original_text: string;
  original_language_code: string;
  english_text: string | null;
  arabic_text: string | null;
  urdu_text: string | null;
  persian_text: string | null;
  pashto_text: string | null;
};

function translationKey(recordTable: string, recordId: string | null | undefined, fieldName: string) {
  return `${recordTable}:${recordId ?? ""}:${fieldName}`;
}

function resolveTranslation(row: TranslationRow | null | undefined, language: "en" | "ar" | "ur" | "fa" | "ps", fallback: string) {
  if (!row) return fallback;
  return multilingualService.resolveText(
    {
      originalText: row.original_text,
      originalLanguage: row.original_language_code as "en" | "ar" | "ur" | "fa" | "ps",
      en: row.english_text ?? undefined,
      ar: row.arabic_text ?? undefined,
      ur: row.urdu_text ?? undefined,
      fa: row.persian_text ?? undefined,
      ps: row.pashto_text ?? undefined
    },
    language
  ) || fallback;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      scope: request.nextUrl.searchParams.get("scope") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      language: request.nextUrl.searchParams.get("language") ?? undefined
    });
    const effectiveQuery = { ...query };

    if (!session.isSuperAdmin) {
      const isCountryScope = session.roles.includes("country_admin") || session.roles.includes("country_user");
      const isMainBranchScope = session.roles.includes("main_branch_admin");

      if (isCountryScope) {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
      } else if (isMainBranchScope) {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
        if (!effectiveQuery.countryBranchId && session.countryBranchIds[0]) {
          effectiveQuery.countryBranchId = session.countryBranchIds[0];
        }
      } else {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
        if (!effectiveQuery.countryBranchId && session.countryBranchIds[0]) {
          effectiveQuery.countryBranchId = session.countryBranchIds[0];
        }
        if (!effectiveQuery.cityBranchId && session.cityBranchIds[0]) {
          effectiveQuery.cityBranchId = session.cityBranchIds[0];
        }
      }
    }

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      countryId: effectiveQuery.countryId ?? null,
      countryBranchId: effectiveQuery.countryBranchId ?? null,
      cityBranchId: effectiveQuery.cityBranchId ?? null
    });

    const supabase = createSupabaseAdminClient() as any;
    const sessionUserIdIsUuid = uuidSchema.safeParse(session.userId).success;

    const profileRes = sessionUserIdIsUuid
      ? await supabase.from("profiles").select("id, full_name, default_company_id").eq("id", session.userId).maybeSingle()
      : { data: null, error: null };

    let accountQuery = supabase
      .from("enterprise_accounts")
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, contacts, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (effectiveQuery.scope) accountQuery = accountQuery.eq("scope", effectiveQuery.scope);
    if (effectiveQuery.countryId) accountQuery = accountQuery.eq("country_id", effectiveQuery.countryId);
    if (effectiveQuery.countryBranchId) accountQuery = accountQuery.eq("country_branch_id", effectiveQuery.countryBranchId);
    if (effectiveQuery.cityBranchId) accountQuery = accountQuery.eq("city_branch_id", effectiveQuery.cityBranchId);
    if (effectiveQuery.status !== "all") accountQuery = accountQuery.eq("status", effectiveQuery.status);
    if (effectiveQuery.fromDate) accountQuery = accountQuery.gte("created_at", `${effectiveQuery.fromDate}T00:00:00.000Z`);
    if (effectiveQuery.toDate) accountQuery = accountQuery.lte("created_at", `${effectiveQuery.toDate}T23:59:59.999Z`);

    const accountRes = await accountQuery.limit(effectiveQuery.limit);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (accountRes.error) throw new Error(accountRes.error.message);

    const accountRows = (accountRes.data ?? []) as EnterpriseAccountRow[];
    const accountIds = accountRows.map((row) => row.id);

    // Helper to chunk arrays to avoid URL length limits (> 16KB)
    async function fetchInChunks<T>(items: string[], chunkSize: number, fetcher: (chunk: string[]) => Promise<{ data: T[] | null; error: any }>) {
      if (!items.length) return { data: [], error: null };
      const results: T[] = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const res = await fetcher(chunk);
        if (res.error) return { data: null, error: res.error };
        if (res.data) results.push(...res.data);
      }
      return { data: results, error: null };
    }

    const translationRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("record_translations")
        .select("record_table, record_id, field_name, original_text, original_language_code, english_text, arabic_text, urdu_text, persian_text, pashto_text")
        .eq("record_table", "enterprise_accounts")
        .in("record_id", chunk)
        .is("deleted_at", null);
    });
    if (translationRes.error) throw new Error(translationRes.error.message);
    const translationLookup = new Map(
      ((translationRes.data ?? []) as TranslationRow[]).map((row) => [translationKey(row.record_table, row.record_id, row.field_name), row] as const)
    );

    const ledgerRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("ledgers")
        .select("id, enterprise_account_id, parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, normal_balance, is_active, created_at, updated_at")
        .is("deleted_at", null)
        .in("enterprise_account_id", chunk);
    });

    const postingRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("ledger_posting_lines")
        .select("enterprise_account_id, ledger_id, batch_id, debit, credit, currency, usd_rate, usd_amount, created_at")
        .in("enterprise_account_id", chunk);
    });

    const roznamchaLineRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("roznamcha_lines")
        .select("enterprise_account_id, ledger_id, roznamcha_entry_id, debit, credit, currency, usd_rate, usd_amount")
        .in("enterprise_account_id", chunk);
    });

    const auditRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("audit_logs")
        .select("entity_id, entity_table, action, created_at")
        .in("entity_id", chunk)
        .in("entity_table", ["enterprise_accounts", "ledgers"]);
    });

    if (ledgerRes.error) throw new Error(ledgerRes.error.message);
    if (postingRes.error) throw new Error(postingRes.error.message);
    if (roznamchaLineRes.error) throw new Error(roznamchaLineRes.error.message);
    if (auditRes.error) throw new Error(auditRes.error.message);

    const ledgers = (ledgerRes.data ?? []) as LedgerRow[];
    const postingLines = (postingRes.data ?? []) as PostingLineRow[];
    const rozLines = (roznamchaLineRes.data ?? []) as RoznamchaLineRow[];
    const audits = (auditRes.data ?? []) as AuditRow[];

    const batchIds = [...new Set(postingLines.map((row) => row.batch_id).filter((value): value is string => Boolean(value)))];
    const entryIds = [...new Set(rozLines.map((row) => row.roznamcha_entry_id).filter((value): value is string => Boolean(value)))];

    const postingBatchRes = await fetchInChunks(batchIds, 150, async (chunk) => {
      return supabase.from("ledger_posting_batches").select("id, reference_no, entry_date, status, created_at").in("id", chunk);
    });

    const roznamchaEntryRes = await fetchInChunks(entryIds, 150, async (chunk) => {
      return supabase.from("roznamcha_entries").select("id, voucher_no, entry_date, status, created_at").in("id", chunk);
    });

    if (postingBatchRes.error) throw new Error(postingBatchRes.error.message);
    if (roznamchaEntryRes.error) throw new Error(roznamchaEntryRes.error.message);

    const postingBatches = (postingBatchRes.data ?? []) as PostingBatchRow[];
    const rozEntries = (roznamchaEntryRes.data ?? []) as RoznamchaEntryRow[];

    const countryIds = [...new Set(accountRows.map((row) => row.country_id).filter((value): value is string => Boolean(value)))];
    const countryBranchIds = [...new Set(accountRows.map((row) => row.country_branch_id).filter((value): value is string => Boolean(value)))];
    const cityBranchIds = [...new Set(accountRows.map((row) => row.city_branch_id).filter((value): value is string => Boolean(value)))];
    const customerIds = [...new Set(accountRows.map((row) => row.customer_id).filter((value): value is string => Boolean(value)))];
    const companyIds = [...new Set(accountRows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))];
    const bankIds = [...new Set(accountRows.map((row) => row.bank_id).filter((value): value is string => Boolean(value)))];

    const countriesRes = await fetchInChunks(countryIds, 150, async (chunk) => supabase.from("countries").select("id, name, iso2, currency_code").in("id", chunk));
    const countryBranchesRes = await fetchInChunks(countryBranchIds, 150, async (chunk) => supabase.from("country_branches").select("id, country_id, name, code, local_currency, status").in("id", chunk));
    const cityBranchesRes = await fetchInChunks(cityBranchIds, 150, async (chunk) => supabase.from("city_branches").select("id, country_id, country_branch_id, city_name, name, code, local_currency, status").in("id", chunk));
    const companyRes = profileRes.data?.default_company_id ? await supabase.from("companies").select("id, name, legal_name, base_currency, created_at, updated_at").eq("id", profileRes.data.default_company_id).maybeSingle() : { data: null, error: null };
    const customersRes = await fetchInChunks(customerIds, 150, async (chunk) => supabase.from("customers").select("id, customer_name").in("id", chunk));
    const companiesListRes = await fetchInChunks(companyIds, 150, async (chunk) => supabase.from("companies").select("id, name, legal_name").in("id", chunk));
    const banksListRes = await fetchInChunks(bankIds, 150, async (chunk) => supabase.from("banks").select("id, bank_name, branch_name, account_number, phone, email").in("id", chunk));

    if (countriesRes.error) throw new Error(countriesRes.error.message);
    if (countryBranchesRes.error) throw new Error(countryBranchesRes.error.message);
    if (cityBranchesRes.error) throw new Error(cityBranchesRes.error.message);
    if (companyRes.error) throw new Error(companyRes.error.message);
    if (customersRes.error) throw new Error(customersRes.error.message);

    const countries = (countriesRes.data ?? []) as Array<{ id: string; name: string; iso2: string | null; currency_code: string }>;
    const countryBranches = (countryBranchesRes.data ?? []) as Array<{
      id: string;
      country_id: string;
      name: string;
      code: string;
      local_currency: string;
      status: string;
    }>;
    const cityBranches = (cityBranchesRes.data ?? []) as Array<{
      id: string;
      country_id: string;
      country_branch_id: string;
      city_name: string;
      name: string;
      code: string;
      local_currency: string;
      status: string;
    }>;
    const customers = (customersRes.data ?? []) as Array<{ id: string; customer_name: string }>;
    const company = companyRes.data as { id: string; name: string; legal_name: string | null; base_currency: string } | null;
    const profile = profileRes.data as { id: string; full_name: string | null; default_company_id: string | null } | null;

    const countryLookup = new Map(countries.map((row) => [row.id, row] as const));
    const countryBranchLookup = new Map(countryBranches.map((row) => [row.id, row] as const));
    const cityBranchLookup = new Map(cityBranches.map((row) => [row.id, row] as const));
    const ledgerLookup = new Map(ledgers.map((row) => [row.enterprise_account_id ?? row.id, row] as const));
    const customerLookup = new Map(customers.map((row) => [row.id, row.customer_name] as const));
    const companiesLookup = new Map(((companiesListRes.data ?? []) as any[]).map((row) => [row.id, row]));
    const banksLookup = new Map(((banksListRes.data ?? []) as any[]).map((row) => [row.id, row]));

    const postingByAccount = new Map<string, PostingLineRow[]>();
    for (const line of postingLines) {
      if (!line.enterprise_account_id) continue;
      const list = postingByAccount.get(line.enterprise_account_id) ?? [];
      list.push(line);
      postingByAccount.set(line.enterprise_account_id, list);
    }

    const rozByAccount = new Map<string, RoznamchaLineRow[]>();
    for (const line of rozLines) {
      if (!line.enterprise_account_id) continue;
      const list = rozByAccount.get(line.enterprise_account_id) ?? [];
      list.push(line);
      rozByAccount.set(line.enterprise_account_id, list);
    }

    const batchLookup = new Map(postingBatches.map((row) => [row.id, row] as const));
    const rozLookup = new Map(rozEntries.map((row) => [row.id, row] as const));

    const auditByEntity = new Map<string, AuditRow[]>();
    for (const row of audits) {
      if (!row.entity_id) continue;
      const list = auditByEntity.get(row.entity_id) ?? [];
      list.push(row);
      auditByEntity.set(row.entity_id, list);
    }

    const rows = accountRows.map((account) => {
      const linkedLedger = ledgerLookup.get(account.id) ?? null;
      const postingMovements = postingByAccount.get(account.id) ?? [];
      const rozMovements = rozByAccount.get(account.id) ?? [];
      const allMovements = [
        ...postingMovements.map((line) => ({
          source: "ledger" as const,
          id: line.batch_id,
          createdAt: line.created_at,
          referenceNo: batchLookup.get(line.batch_id)?.reference_no ?? null,
          entryDate: batchLookup.get(line.batch_id)?.entry_date ?? line.created_at.slice(0, 10),
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          currency: line.currency,
          usdRate: toNumber(line.usd_rate),
          usdAmount: toNumber(line.usd_amount)
        })),
        ...rozMovements.map((line) => ({
          source: "roznamcha" as const,
          id: line.roznamcha_entry_id,
          createdAt: `${rozLookup.get(line.roznamcha_entry_id)?.entry_date ?? account.created_at.slice(0, 10)}T00:00:00.000Z`,
          referenceNo: rozLookup.get(line.roznamcha_entry_id)?.voucher_no ?? null,
          entryDate: rozLookup.get(line.roznamcha_entry_id)?.entry_date ?? account.created_at.slice(0, 10),
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          currency: line.currency,
          usdRate: toNumber(line.usd_rate),
          usdAmount: toNumber(line.usd_amount)
        }))
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const accountAudits = (auditByEntity.get(account.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latestAudit = accountAudits[0] ?? null;

      const debitTotal = allMovements.reduce((sum, row) => sum + row.debit, 0);
      const creditTotal = allMovements.reduce((sum, row) => sum + row.credit, 0);
      const latestMovement = allMovements[0] ?? null;
      const latestJournalNo = latestMovement?.referenceNo ?? linkedLedger?.code ?? account.code;
      const latestActivityAt = latestMovement?.createdAt ?? latestAudit?.created_at ?? account.updated_at;
      const journalActivityCount = new Set(allMovements.map((row) => `${row.source}:${row.id}`)).size;

      const country = account.country_id ? countryLookup.get(account.country_id) ?? null : null;
      const countryBranch = account.country_branch_id ? countryBranchLookup.get(account.country_branch_id) ?? null : null;
      const cityBranch = account.city_branch_id ? cityBranchLookup.get(account.city_branch_id) ?? null : null;
      const accountName = resolveTranslation(
        translationLookup.get(translationKey("enterprise_accounts", account.id, "name")),
        effectiveQuery.language,
        account.name
      );
      const translatedCompanyName = resolveTranslation(
        translationLookup.get(translationKey("enterprise_accounts", account.id, "company_name")),
        effectiveQuery.language,
        ""
      );
      const translatedBusinessName = resolveTranslation(
        translationLookup.get(translationKey("enterprise_accounts", account.id, "business_name")),
        effectiveQuery.language,
        ""
      );
      const translatedCityName = resolveTranslation(
        translationLookup.get(translationKey("enterprise_accounts", account.id, "city")),
        effectiveQuery.language,
        cityBranch?.city_name ?? "-"
      );

      const branchType =
        account.scope === "super_admin"
          ? "Super Admin"
          : account.scope === "country"
            ? "Country"
            : account.scope === "main_branch"
              ? "Main Branch"
              : "City Branch";

      const branchName =
        account.scope === "super_admin"
          ? "Super Admin Workspace"
          : account.scope === "country"
            ? country?.name ?? "-"
            : account.scope === "main_branch"
              ? countryBranch?.name ?? "-"
              : cityBranch?.name ?? "-";

      const mainBranchName =
        account.scope === "city_branch"
          ? account.country_branch_id
            ? countryBranchLookup.get(account.country_branch_id)?.name ?? "-"
            : "-"
          : account.scope === "main_branch"
            ? countryBranch?.name ?? "-"
            : account.scope === "country"
              ? country?.name ?? "-"
              : "Super Admin Workspace";

      const cityBranchName = account.scope === "city_branch" ? cityBranch?.name ?? cityBranch?.city_name ?? "-" : "-";

      const branchCode =
        account.scope === "super_admin"
          ? "SUPER"
          : account.scope === "country"
            ? country?.iso2 ?? "-"
            : account.scope === "main_branch"
              ? countryBranch?.code ?? "-"
              : cityBranch?.code ?? "-";

      const linkedComp = account.company_id ? companiesLookup.get(account.company_id) : null;
      const linkedBnk = account.bank_id ? banksLookup.get(account.bank_id) : null;
      const contactsList = Array.isArray(account.contacts) ? account.contacts : [];
      const findContact = (prefix: string) => contactsList.find(c => c?.type?.toLowerCase()?.includes(prefix))?.value ?? null;

      const mobileVal = findContact("mobile") || findContact("phone") || linkedBnk?.phone || "-";
      const whatsappVal = findContact("whatsapp") || findContact("wa") || mobileVal;
      const emailVal = findContact("email") || linkedBnk?.email || "-";
      const ownerVal = findContact("owner") || linkedComp?.legal_name || linkedComp?.name || profile?.full_name || "-";
      const warehouseVal = findContact("warehouse") || "-";
      const bankVal = linkedBnk?.bank_name || (account.is_control_account ? accountName : "-");
      const companyVal = linkedComp?.name || translatedCompanyName || translatedBusinessName || company?.name || profile?.full_name || "-";

      return {
        accountId: account.id,
        accountCode: account.account_number || account.code,
        rawAccountCode: account.code,
        customerId: account.customer_id,
        customerName: account.customer_id ? customerLookup.get(account.customer_id) ?? "-" : "-",
        customerNumber: account.customer_number || `CUST-${account.code}`,
        companyId: account.company_id,
        bankId: account.bank_id,
        accountSerialNumber: Number(account.account_serial_number ?? 0),
        countrySerialNumber: account.country_serial_number ?? "-",
        branchSerialNumber: account.branch_serial_number ?? "-",
        manualReferenceNumber: account.manual_reference_number ?? null,
        branchAccountSequence: Number(account.branch_account_sequence ?? 0),
        accountName,
        journalCode: linkedLedger?.code ?? account.code,
        ledgerId: linkedLedger?.id ?? null,
        ledgerName: linkedLedger?.name ?? null,
        ledgerStatus: linkedLedger?.is_active === false ? "inactive" : "active",
        ledgerCurrency: linkedLedger?.currency ?? account.currency,
        branchType,
        branchName,
        mainBranchName,
        cityBranchName,
        branchCode: account.branch_code || branchCode,
        countryId: account.country_id,
        countryName: country?.name ?? "-",
        countryCode: country?.iso2 ?? "-",
        stateName: "-",
        stateCode: "-",
        cityId: account.city_branch_id,
        cityName: translatedCityName,
        cityCode: cityBranch?.code ?? "-",
        currency: account.currency,
        accountCategory: titleCase(account.kind),
        subType: account.is_control_account ? "Control Account" : "Normal Account",
        status: account.status,
        createdAt: account.creation_date || account.created_at,
        openingBalance: toNumber(account.opening_balance),
        debitTotal,
        creditTotal,
        currentBalance: toNumber(account.current_balance),
        linkedLedgerCount: linkedLedger ? 1 : 0,
        journalActivityCount,
        latestJournalNo,
        latestActivityAt,
        companyName: companyVal,
        bankName: bankVal,
        warehouseName: warehouseVal,
        ownerName: ownerVal,
        mobile: mobileVal,
        whatsapp: whatsappVal,
        email: emailVal,
        companyCode: company?.id ? parseIdPrefix(company.id) : "-",
        companyOwner: ownerVal,
        recentActivityLabel: latestAudit?.action ?? latestMovement?.referenceNo ?? null,
        recentActivityAt: latestActivityAt,
        recentMovements: allMovements.map((row) => ({
          source: row.source,
          referenceNo: row.referenceNo,
          entryDate: row.entryDate,
          debit: row.debit,
          credit: row.credit,
          currency: row.currency,
          usdRate: row.usdRate,
          usdAmount: row.usdAmount
        })),
        contacts: contactsList
      };
    });

    const q = normalizeSearch(effectiveQuery.q ?? "");
    const filtered = q
      ? rows.filter((row) =>
          normalizeSearch(
            [
              row.accountCode,
              row.rawAccountCode,
              row.customerNumber,
              row.countrySerialNumber,
              row.branchSerialNumber,
              row.manualReferenceNumber ?? "",
              row.accountName,
              row.journalCode,
              row.ledgerName,
              row.branchName,
              row.branchCode,
              row.countryName,
              row.countryCode,
              row.cityName,
              row.cityCode,
              row.branchType,
              row.currency,
              row.accountCategory,
              row.subType,
              row.status,
              row.companyName,
              row.companyCode,
              row.companyOwner,
              row.latestJournalNo ?? "",
              row.recentActivityLabel ?? ""
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(q)
        )
      : rows;

    const summary = {
      totalAccounts: filtered.length,
      activeAccounts: filtered.filter((row) => row.status === "active").length,
      countryAccounts: filtered.filter((row) => row.branchType === "Country").length,
      branchAccounts: filtered.filter((row) => row.branchType === "Main Branch" || row.branchType === "City Branch").length,
      adminAccounts: filtered.filter((row) => row.branchType === "Super Admin").length,
      totalLedgers: filtered.reduce((sum, row) => sum + row.linkedLedgerCount, 0),
      activeLedgers: filtered.filter((row) => row.ledgerStatus === "active").length,
      openingBalanceTotal: filtered.reduce((sum, row) => sum + row.openingBalance, 0),
      debitTotal: filtered.reduce((sum, row) => sum + row.debitTotal, 0),
      creditTotal: filtered.reduce((sum, row) => sum + row.creditTotal, 0),
      currentBalanceTotal: filtered.reduce((sum, row) => sum + row.currentBalance, 0),
      journalActivityTotal: filtered.reduce((sum, row) => sum + row.journalActivityCount, 0),
      recentUpdates: filtered.filter((row) => row.latestActivityAt && new Date(row.latestActivityAt).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 7).length
    };

    return apiOk({
      summary,
      workspace: {
        companyId: profile?.default_company_id ?? null,
        companyName: company?.name || profile?.full_name || "-",
        companyCode: company?.id ? parseIdPrefix(company.id) : "-",
        companyOwner: profile?.full_name ?? "-"
      },
      rows: filtered,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
