import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { localizeRecordGroups } from "@/lib/i18n/localize-records";

/**
 * Journal Reporting data layer — sibling to ledger-report-service.ts, not a duplicate of it.
 * ledger-report-service.ts answers "what is this ONE ledger's balance/statement"; this answers
 * "give me every journal/ledger LINE across the whole scope that matches an arbitrary composed
 * filter set" (the register behind the Journal Reporting page). Both read the same two source
 * tables (roznamcha_entries/roznamcha_lines, ledger_posting_batches/ledger_posting_lines) and
 * follow the same withLocalPg-primary / session-scope-OR pattern established there — see the
 * comment on LedgerReportService.listLedgers for why direct Postgres is required (RLS on these
 * tables is gated on auth.uid(), which is always NULL under this app's temp-session bootstrap).
 *
 * Design note (why one merged JS array, not two separate aggregate queries): the Journal
 * Reporting spec's core requirement is that KPI cards, charts and the register table can NEVER
 * diverge — they must all read the SAME active filter set. The simplest way to *guarantee* that
 * (rather than re-deriving matching WHERE clauses three times and hoping they stay in sync) is to
 * fetch the filtered+scoped row set ONCE here and let the API route derive cards/charts/table
 * pagination from that single array. Capped at a generous row limit for safety.
 */

export type JournalReportScope = "super_admin" | "country" | "branch";

export type JournalRegisterRow = {
  id: string; // line id — unique per row
  entryId: string; // parent roznamcha_entries.id / ledger_posting_batches.id
  sourceTable: "roznamcha" | "ledger_posting";
  date: string;
  journalNo: string | null;
  voucherNo: string | null;
  referenceNo: string | null;
  description: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  customerId: string | null;
  customerName: string | null;
  companyId: string | null;
  companyName: string | null;
  debit: number;
  credit: number;
  currency: string;
  usdRate: number;
  countryId: string | null;
  countryName: string | null;
  countryBranchId: string | null;
  countryBranchName: string | null;
  cityBranchId: string | null;
  cityBranchName: string | null;
  createdById: string | null;
  createdByName: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  /** Derived: roznamcha_entries has no approval_status column (only approved_by/approved_at);
   *  ledger_posting_batches.approval_status is a real text column. Normalized to one binary
   *  classification here so both sources behave the same way for filtering/reporting. */
  approvalStatus: "approved" | "pending";
  status: string; // document_status: draft | posted | cancelled
  /** Real column only on the roznamcha side (roznamcha_lines.payment_entry_type). null for
   *  ledger_posting rows — there is no equivalent column there. */
  journalType: string | null;
  /** Real column only on the ledger_posting side (ledger_posting_batches.transaction_type).
   *  null for roznamcha rows — there is no equivalent column there. */
  voucherType: string | null;
  createdAt: string;
};

export type JournalRegisterFilters = {
  session: ErpSession;
  reportScope: JournalReportScope;
  fromDate: string;
  toDate: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  companyId?: string | null;
  /** Matches ledger_id OR account_id OR enterprise_account_id on the line — "Account / Ledger". */
  ledgerId?: string | null;
  customerId?: string | null;
  journalType?: string | null;
  voucherType?: string | null;
  currency?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvalStatus?: "approved" | "pending" | null;
  status?: string | null;
  drCr?: "debit" | "credit" | null;
  referenceNo?: string | null;
  limit?: number;
  /** When set, human-readable names (account/company/customer/country/branch) are resolved
   *  through the central per-language master-data translator (record_translations + approved
   *  dictionary — see lib/i18n/localize-records.ts), same as ledger-report-service.ts. */
  language?: SupportedLanguage | null;
};

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unique<T>(values: Array<T | null | undefined>): T[] {
  return [...new Set(values.filter((v): v is T => v !== null && v !== undefined))];
}

export class JournalReportService {
  async getJournalRegister(input: JournalRegisterFilters): Promise<JournalRegisterRow[]> {
    const rows = await withLocalPg((sql) => this.queryViaPg(sql, input));
    return rows ?? [];
  }

  /**
   * Net (debit - credit) of every matching line strictly before `fromDate`, using the same
   * filter set (minus the date range). This is an exact "opening balance" when the filter set
   * narrows to a single account/ledger; across a mixed set of accounts it is still the correct
   * arithmetic amount brought forward for that same filtered population — never fabricated.
   */
  async getOpeningBalance(input: JournalRegisterFilters): Promise<number> {
    const priorRows = await this.getJournalRegister({
      ...input,
      fromDate: "1900-01-01",
      toDate: input.fromDate,
      limit: 50000
    });
    return priorRows.filter((r) => r.date < input.fromDate).reduce((sum, r) => sum + (r.debit - r.credit), 0);
  }

  private async queryViaPg(sql: any, input: JournalRegisterFilters): Promise<JournalRegisterRow[]> {
    const { session } = input;
    const limit = Math.max(1, Math.min(input.limit ?? 8000, 20000));

    // Session scope — same OR-of-city/country-branch/country idiom as
    // ledger-report-service.ts's listLedgersViaPg. Written twice (once per table alias) because
    // postgres.js fragments are built against a fixed column reference and the two source
    // queries below alias their tables differently (re./lpb.) — not a parallel scope system,
    // the same rule, just re-anchored to each query's own alias.
    const hasScope = Boolean(session.cityBranchIds?.length || session.countryBranchIds?.length || session.countryIds?.length);
    const scopeCondRoz = session.isSuperAdmin
      ? sql`true`
      : hasScope
        ? sql`(re.city_branch_id = ANY(${session.cityBranchIds ?? []}::uuid[]) OR re.country_branch_id = ANY(${session.countryBranchIds ?? []}::uuid[]) OR re.country_id = ANY(${session.countryIds ?? []}::uuid[]))`
        : sql`false`;
    const scopeCondLpb = session.isSuperAdmin
      ? sql`true`
      : hasScope
        ? sql`(lpb.city_branch_id = ANY(${session.cityBranchIds ?? []}::uuid[]) OR lpb.country_branch_id = ANY(${session.countryBranchIds ?? []}::uuid[]) OR lpb.country_id = ANY(${session.countryIds ?? []}::uuid[]))`
        : sql`false`;

    // reportScope tab clamp — mirrors ledger-report-service.ts's scopeTabCond.
    const scopeTabRoz =
      input.reportScope === "country" ? sql`re.type != 'super_admin'`
      : input.reportScope === "branch" ? sql`re.type = 'branch'`
      : sql`true`;
    const scopeTabLpb =
      input.reportScope === "country" ? sql`lpb.scope != 'super_admin'`
      : input.reportScope === "branch" ? sql`lpb.scope = 'city_branch'`
      : sql`true`;

    const countryCondRoz = input.countryId ? sql`re.country_id = ${input.countryId}` : sql`true`;
    const countryCondLpb = input.countryId ? sql`lpb.country_id = ${input.countryId}` : sql`true`;
    const countryBranchCondRoz = input.countryBranchId ? sql`re.country_branch_id = ${input.countryBranchId}` : sql`true`;
    const countryBranchCondLpb = input.countryBranchId ? sql`lpb.country_branch_id = ${input.countryBranchId}` : sql`true`;
    const cityBranchCondRoz = input.cityBranchId ? sql`re.city_branch_id = ${input.cityBranchId}` : sql`true`;
    const cityBranchCondLpb = input.cityBranchId ? sql`lpb.city_branch_id = ${input.cityBranchId}` : sql`true`;

    const ledgerCondRoz = input.ledgerId
      ? sql`(rl.ledger_id = ${input.ledgerId} OR rl.account_id = ${input.ledgerId} OR rl.enterprise_account_id = ${input.ledgerId})`
      : sql`true`;
    const ledgerCondLpb = input.ledgerId
      ? sql`(lpl.ledger_id = ${input.ledgerId} OR lpl.account_id = ${input.ledgerId} OR lpl.enterprise_account_id = ${input.ledgerId})`
      : sql`true`;

    const companyCondRoz = input.companyId ? sql`ea.company_id = ${input.companyId}` : sql`true`;
    const companyCondLpb = input.companyId ? sql`ea2.company_id = ${input.companyId}` : sql`true`;
    const customerCondRoz = input.customerId ? sql`ea.customer_id = ${input.customerId}` : sql`true`;
    const customerCondLpb = input.customerId ? sql`ea2.customer_id = ${input.customerId}` : sql`true`;

    const currencyCondRoz = input.currency ? sql`upper(rl.currency) = upper(${input.currency})` : sql`true`;
    const currencyCondLpb = input.currency ? sql`upper(lpl.currency) = upper(${input.currency})` : sql`true`;

    const createdByCondRoz = input.createdBy ? sql`re.created_by = ${input.createdBy}` : sql`true`;
    const createdByCondLpb = input.createdBy ? sql`lpb.created_by = ${input.createdBy}` : sql`true`;
    const approvedByCondRoz = input.approvedBy ? sql`re.approved_by = ${input.approvedBy}` : sql`true`;
    const approvedByCondLpb = input.approvedBy ? sql`lpb.approved_by = ${input.approvedBy}` : sql`true`;

    const statusCondRoz = input.status ? sql`re.status = ${input.status}` : sql`true`;
    const statusCondLpb = input.status ? sql`lpb.status = ${input.status}` : sql`true`;

    const drCrCondRoz = input.drCr === "debit" ? sql`rl.debit > 0` : input.drCr === "credit" ? sql`rl.credit > 0` : sql`true`;
    const drCrCondLpb = input.drCr === "debit" ? sql`lpl.debit > 0` : input.drCr === "credit" ? sql`lpl.credit > 0` : sql`true`;

    const refLike = input.referenceNo ? `%${input.referenceNo}%` : null;
    const refCondRoz = refLike
      ? sql`(re.voucher_no ilike ${refLike} OR re.reference_no ilike ${refLike} OR re.journal_no ilike ${refLike})`
      : sql`true`;
    const refCondLpb = refLike ? sql`lpb.reference_no ilike ${refLike}` : sql`true`;

    const journalTypeCondRoz = input.journalType ? sql`rl.payment_entry_type = ${input.journalType}` : sql`true`;
    const voucherTypeCondLpb = input.voucherType ? sql`lpb.transaction_type = ${input.voucherType}` : sql`true`;

    // Journal Type / Voucher Type each have a real column on only ONE of the two sources
    // (see field comments on JournalRegisterRow). When one of those filters is active, the
    // source without that column is excluded outright rather than silently ignoring the filter.
    const skipRozForVoucherType = Boolean(input.voucherType);
    const skipLpbForJournalType = Boolean(input.journalType);

    const rozRowsRaw = skipRozForVoucherType
      ? []
      : await sql`
          select
            rl.id as line_id, re.id as entry_id, 'roznamcha'::text as source_table,
            re.entry_date::text as date, re.journal_no, re.voucher_no, re.reference_no,
            rl.description, rl.debit, rl.credit, rl.currency, rl.usd_rate,
            rl.ledger_id, rl.account_id, rl.enterprise_account_id, rl.payment_entry_type as journal_type,
            null::text as voucher_type, null::text as approval_status,
            re.status, re.country_id, re.country_branch_id, re.city_branch_id,
            re.created_by, re.approved_by, re.created_at
          from roznamcha_lines rl
          join roznamcha_entries re on re.id = rl.roznamcha_entry_id
          left join enterprise_accounts ea on ea.id = rl.enterprise_account_id
          where re.deleted_at is null
            and ${scopeCondRoz} and ${scopeTabRoz}
            and re.entry_date >= ${input.fromDate} and re.entry_date <= ${input.toDate}
            and ${countryCondRoz} and ${countryBranchCondRoz} and ${cityBranchCondRoz}
            and ${ledgerCondRoz} and ${companyCondRoz} and ${customerCondRoz}
            and ${currencyCondRoz} and ${createdByCondRoz} and ${approvedByCondRoz}
            and ${statusCondRoz} and ${drCrCondRoz} and ${refCondRoz} and ${journalTypeCondRoz}
          order by re.entry_date asc
          limit ${limit}
        `;

    const lpbRowsRaw = skipLpbForJournalType
      ? []
      : await sql`
          select
            lpl.id as line_id, lpb.id as entry_id, 'ledger_posting'::text as source_table,
            lpb.entry_date::text as date, null::text as journal_no, null::text as voucher_no, lpb.reference_no,
            lpl.description, lpl.debit, lpl.credit, lpl.currency, lpl.usd_rate,
            lpl.ledger_id, lpl.account_id, lpl.enterprise_account_id, null::text as journal_type,
            lpb.transaction_type as voucher_type, lpb.approval_status,
            lpb.status, lpb.country_id, lpb.country_branch_id, lpb.city_branch_id,
            lpb.created_by, lpb.approved_by, lpb.created_at
          from ledger_posting_lines lpl
          join ledger_posting_batches lpb on lpb.id = lpl.batch_id
          left join enterprise_accounts ea2 on ea2.id = lpl.enterprise_account_id
          where lpb.deleted_at is null
            and ${scopeCondLpb} and ${scopeTabLpb}
            and lpb.entry_date >= ${input.fromDate} and lpb.entry_date <= ${input.toDate}
            and ${countryCondLpb} and ${countryBranchCondLpb} and ${cityBranchCondLpb}
            and ${ledgerCondLpb} and ${companyCondLpb} and ${customerCondLpb}
            and ${currencyCondLpb} and ${createdByCondLpb} and ${approvedByCondLpb}
            and ${statusCondLpb} and ${drCrCondLpb} and ${refCondLpb} and ${voucherTypeCondLpb}
          order by lpb.entry_date asc
          limit ${limit}
        `;

    const rawRows = [...(rozRowsRaw as any[]), ...(lpbRowsRaw as any[])];
    if (rawRows.length === 0) return [];

    const accountIds = unique(rawRows.map((r) => r.enterprise_account_id));
    const ledgerIds = unique(rawRows.map((r) => r.ledger_id));
    const countryIds = unique(rawRows.map((r) => r.country_id));
    const countryBranchIds = unique(rawRows.map((r) => r.country_branch_id));
    const cityBranchIds = unique(rawRows.map((r) => r.city_branch_id));
    const userIds = unique([...rawRows.map((r) => r.created_by), ...rawRows.map((r) => r.approved_by)]);

    const [eaRows, ledgerRows, countryRows, cbRows, cityBRows, userRows] = await Promise.all([
      accountIds.length
        ? sql`select id, name, code, company_id, customer_id from enterprise_accounts where id = any(${accountIds}::uuid[])`
        : Promise.resolve([]),
      ledgerIds.length ? sql`select id, name, code from ledgers where id = any(${ledgerIds}::uuid[])` : Promise.resolve([]),
      countryIds.length ? sql`select id, name from countries where id = any(${countryIds}::uuid[])` : Promise.resolve([]),
      countryBranchIds.length
        ? sql`select id, name from country_branches where id = any(${countryBranchIds}::uuid[])`
        : Promise.resolve([]),
      cityBranchIds.length ? sql`select id, name from city_branches where id = any(${cityBranchIds}::uuid[])` : Promise.resolve([]),
      userIds.length ? sql`select id, full_name from profiles where id = any(${userIds}::uuid[])` : Promise.resolve([])
    ]);

    const companyIds = unique((eaRows as any[]).map((r) => r.company_id));
    const customerIds = unique((eaRows as any[]).map((r) => r.customer_id));
    const [companyRows, customerRows] = await Promise.all([
      companyIds.length ? sql`select id, name from companies where id = any(${companyIds}::uuid[])` : Promise.resolve([]),
      customerIds.length
        ? sql`select id, customer_name from customers where id = any(${customerIds}::uuid[])`
        : Promise.resolve([])
    ]);

    // Resolve every human-readable name into the viewer's language through the same central
    // per-language master-data translator ledger-report-service.ts uses (record_translations +
    // approved dictionary, never a machine-guessed spelling) — one shared connection, one pass
    // over every group, instead of a separate query per table.
    const language = input.language ?? null;
    let localizedEa = eaRows as any[];
    let localizedLedger = ledgerRows as any[];
    let localizedCountry = countryRows as any[];
    let localizedCb = cbRows as any[];
    let localizedCityB = cityBRows as any[];
    let localizedCompany = companyRows as any[];
    let localizedCustomer = customerRows as any[];
    if (language) {
      [localizedEa, localizedLedger, localizedCountry, localizedCb, localizedCityB, localizedCompany, localizedCustomer] =
        await localizeRecordGroups(
          [
            { records: eaRows as any[], table: "enterprise_accounts", fields: ["name"] },
            { records: ledgerRows as any[], table: "ledgers", fields: ["name"] },
            { records: countryRows as any[], table: "countries", fields: ["name"] },
            { records: cbRows as any[], table: "country_branches", fields: ["name"] },
            { records: cityBRows as any[], table: "city_branches", fields: ["name"] },
            { records: companyRows as any[], table: "companies", fields: ["name"] },
            { records: customerRows as any[], table: "customers", fields: ["customer_name"] }
          ],
          language
        );
    }

    const eaById = new Map(localizedEa.map((r) => [r.id, r]));
    const ledgerById = new Map(localizedLedger.map((r) => [r.id, r]));
    const countryById = new Map(localizedCountry.map((r) => [r.id, r]));
    const cbById = new Map(localizedCb.map((r) => [r.id, r]));
    const cityBById = new Map(localizedCityB.map((r) => [r.id, r]));
    const userById = new Map((userRows as any[]).map((r) => [r.id, r]));
    const companyById = new Map(localizedCompany.map((r) => [r.id, r]));
    const customerById = new Map(localizedCustomer.map((r) => [r.id, r]));

    const results: JournalRegisterRow[] = rawRows.map((row) => {
      const ea = row.enterprise_account_id ? eaById.get(row.enterprise_account_id) : null;
      const lg = row.ledger_id ? ledgerById.get(row.ledger_id) : null;
      const accountName = ea?.name ?? lg?.name ?? null;
      const accountCode = ea?.code ?? lg?.code ?? null;
      const companyId = ea?.company_id ?? null;
      const customerId = ea?.customer_id ?? null;

      const approvalStatus: "approved" | "pending" = row.approved_by
        ? "approved"
        : row.approval_status === "approved"
          ? "approved"
          : "pending";

      return {
        id: String(row.line_id),
        entryId: String(row.entry_id),
        sourceTable: row.source_table,
        date: row.date,
        journalNo: row.journal_no,
        voucherNo: row.voucher_no,
        referenceNo: row.reference_no,
        description: row.description,
        accountId: row.enterprise_account_id ?? row.ledger_id ?? row.account_id ?? null,
        accountCode,
        accountName,
        customerId,
        customerName: customerId ? (customerById.get(customerId)?.customer_name ?? null) : null,
        companyId,
        companyName: companyId ? (companyById.get(companyId)?.name ?? null) : null,
        debit: toNumber(row.debit),
        credit: toNumber(row.credit),
        currency: row.currency ?? "USD",
        usdRate: toNumber(row.usd_rate) || 1,
        countryId: row.country_id,
        countryName: row.country_id ? (countryById.get(row.country_id)?.name ?? null) : null,
        countryBranchId: row.country_branch_id,
        countryBranchName: row.country_branch_id ? (cbById.get(row.country_branch_id)?.name ?? null) : null,
        cityBranchId: row.city_branch_id,
        cityBranchName: row.city_branch_id ? (cityBById.get(row.city_branch_id)?.name ?? null) : null,
        createdById: row.created_by,
        createdByName: row.created_by ? (userById.get(row.created_by)?.full_name ?? null) : null,
        approvedById: row.approved_by,
        approvedByName: row.approved_by ? (userById.get(row.approved_by)?.full_name ?? null) : null,
        approvalStatus,
        status: row.status,
        journalType: row.journal_type,
        voucherType: row.voucher_type,
        createdAt: String(row.created_at ?? row.date)
      };
    });

    // Approval status is a derived field (see the JournalRegisterRow doc comment above), so it
    // is filtered here in JS after the merge rather than in each source's own WHERE clause.
    const filtered = input.approvalStatus ? results.filter((r) => r.approvalStatus === input.approvalStatus) : results;

    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });

    return filtered;
  }
}

export const journalReportService = new JournalReportService();
