import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

// ─────────────────────────────────────────────────────────────
// Supported report types
// ─────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  "purchase",
  "sales",
  "loading",
  "transfer",
  "payment",
  "remaining",
  "ledger",
  "roznamcha",
  "journal",
  "cash",
  "inventory",
  "daily-comprehensive",
  "purchase-booking",
  "user-activity",
  "exchange-rate",
  // Legacy report types from old general endpoint (keep for backward compat)
  "cash-entry",
  "receipts",
  "payments",
  "customer-accounts",
  "customer-companies",
  "branch-transactions",
  "audit-logs",
  "approval-workflows",
  "expenses",
  "financial-summaries",
  "purchase-booking-register"
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

function isMissingPrivilegedSupabaseKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("SUPABASE_SECRET_KEY") || message.includes("SUPABASE_SERVICE_ROLE_KEY");
}

const reportQuerySchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  countryId: z.string().optional().or(z.literal("all")).or(z.literal("")),
  branchId: z.string().optional().or(z.literal("all")).or(z.literal("")),
  mainBranchId: z.string().optional().or(z.literal("all")).or(z.literal("")),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  currency: z.string().optional(),
  exchangeRate: z.coerce.number().optional(),
  userId: z.string().optional().or(z.literal("all")),
  lang: z.enum(["en", "ur", "ar", "fa", "ps"]).default("en"),
  limit: z.coerce.number().int().min(1).max(2000).default(500)
});

/**
 * GET /api/erp/reports/scoped
 *
 * Unified scoped reports API. Enforces role-based data boundaries:
 * - Super Admin: can query any country/branch
 * - Country Admin: forced to their country
 * - Branch Admin: forced to their branch
 *
 * Supports all 15 report types across 5 languages.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = request.nextUrl;

    const parsed = reportQuerySchema.parse({
      reportType: searchParams.get("reportType") ?? "ledger",
      countryId: searchParams.get("countryId") ?? "all",
      branchId: searchParams.get("branchId") ?? "all",
      mainBranchId: searchParams.get("mainBranchId") ?? "all",
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
      currency: searchParams.get("currency") ?? undefined,
      exchangeRate: searchParams.get("exchangeRate") ?? undefined,
      userId: searchParams.get("userId") ?? "all",
      lang: searchParams.get("lang") ?? "en",
      limit: searchParams.get("limit") ?? undefined
    });

    // Resolve scope and enforce data boundaries
    const scope = resolveReportScope(session);
    const requestedCountryId = parsed.countryId && parsed.countryId !== "all" ? parsed.countryId : null;
    const requestedBranchId = parsed.branchId && parsed.branchId !== "all" ? parsed.branchId : null;

    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      requestedCountryId,
      requestedBranchId
    );

    const limit = parsed.limit;
    const fromDate = parsed.fromDate;
    const toDate = parsed.toDate;

    const needsLedgerLocalFallback = parsed.reportType === "ledger";
    let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
    try {
      admin = createSupabaseAdminClient();
    } catch (error) {
      if (!needsLedgerLocalFallback || !isMissingPrivilegedSupabaseKey(error)) {
        throw error;
      }
    }

    if (!admin && needsLedgerLocalFallback) {
      const lang = normalizeLanguage(parsed.lang, "en");
      const viaPg = await withLocalPg(async (sql) => {
        const ledgerRows = await sql`
          select
            l.id,
            b.entry_date,
            coalesce(l.description, b.narration, b.reference_no, '—') as description,
            l.debit,
            l.credit,
            l.currency,
            coalesce(l.enterprise_account_id, l.account_id) as account_id,
            b.country_id,
            b.country_branch_id,
            b.city_branch_id,
            coalesce(ea.name, a.name, l.account_number, '—') as account_name,
            coalesce(l.account_number, a.code, '—') as account_no,
            coalesce(ea.account_number, a.code, l.account_number, '—') as account_type
          from public.ledger_posting_lines l
          inner join public.ledger_posting_batches b on b.id = l.batch_id and b.deleted_at is null
          left join public.enterprise_accounts ea on ea.id = l.enterprise_account_id and ea.deleted_at is null
          left join public.accounts a on a.id = l.account_id and a.deleted_at is null
          where l.created_at is not null
            and (${effectiveCountryId ? sql`b.country_id = ${effectiveCountryId}` : sql`true`})
            and (${effectiveBranchId ? sql`(b.city_branch_id = ${effectiveBranchId} or b.country_branch_id = ${effectiveBranchId})` : sql`true`})
            and (${fromDate ? sql`b.entry_date >= ${fromDate}` : sql`true`})
            and (${toDate ? sql`b.entry_date <= ${toDate}` : sql`true`})
          order by b.entry_date desc, l.created_at desc
          limit ${limit}
        `;

        return ledgerRows as any[];
      });

      const localizedAccounts = await localizeRecordNames(
        (viaPg ?? []).map((row: any) => ({ id: row.account_id, name: row.account_name ?? row.account_no ?? "—" })),
        "enterprise_accounts",
        "name",
        lang,
        { phraseFallback: true }
      );
      const accountNameById = new Map(localizedAccounts.map((row) => [row.id, row.name] as const));

      const data = (viaPg ?? []).map((r: any) => ({
        serial: r.id?.slice(0, 8),
        date: r.entry_date,
        account: accountNameById.get(r.account_id) || r.account_name || r.account_no || "—",
        accountNo: r.account_no || "—",
        description: r.description || "—",
        debit: Number(r.debit || 0),
        credit: Number(r.credit || 0),
        balance: Number(r.credit || 0) - Number(r.debit || 0),
        currency: r.currency || "PKR",
        status: "posted"
      }));

      const totals = data.reduce((acc: any, r: any) => ({
        totalDebit: (acc.totalDebit || 0) + r.debit,
        totalCredit: (acc.totalCredit || 0) + r.credit
      }), { totalDebit: 0, totalCredit: 0 });

      return apiOk({
        reportType: parsed.reportType,
        scope: {
          level: scope.level,
          label: scope.scopeLabel,
          enforced: {
            countryId: effectiveCountryId,
            branchId: effectiveBranchId
          }
        },
        lang: parsed.lang,
        currency: parsed.currency ?? "USD",
        data,
        summary: { records: data.length, ...totals, netBalance: totals.totalCredit - totals.totalDebit },
        records: data.length,
        generatedAt: new Date().toISOString()
      });
    }

    let data: any[] = [];
    let summary: any = {};

    // Helper to apply standard date + country + branch filters to a Supabase query
    function applyStandardFilters(query: any, opts: {
      dateField?: string;
      countryField?: string;
      branchField?: string;
      cityBranchField?: string;
    } = {}) {
      const {
        dateField = "created_at",
        countryField = "country_id",
        branchField = "country_branch_id",
        cityBranchField = "city_branch_id"
      } = opts;

      if (effectiveCountryId) {
        query = query.eq(countryField, effectiveCountryId);
      }
      if (effectiveBranchId) {
        try {
          query = query.or(`${cityBranchField}.eq.${effectiveBranchId},${branchField}.eq.${effectiveBranchId}`);
        } catch {
          query = query.eq(cityBranchField, effectiveBranchId);
        }
      }
      if (fromDate) query = query.gte(dateField, fromDate);
      if (toDate) query = query.lte(dateField, toDate);

      return query;
    }

    // ── Report type switch ────────────────────────────────────────
    switch (parsed.reportType) {

      // ─── PURCHASE ─────────────────────────────────────────────
      case "purchase": {
        let q = admin
          .from("purchase_orders")
          .select(`id, po_number, po_date, status, total_amount, currency, advance_paid,
                   remaining_amount, country_id, city_branch_id, country_branch_id,
                   customers(name), countries(name, code)`)
          .is("deleted_at", null)
          .order("po_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "po_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.po_number || r.id?.slice(0, 8),
          date: r.po_date,
          customer: r.customers?.name || "—",
          country: r.countries?.name || "—",
          amount: r.total_amount || 0,
          currency: r.currency || "USD",
          advance: r.advance_paid || 0,
          remaining: r.remaining_amount || 0,
          status: r.status
        }));

        const totals = data.reduce((acc: any, r: any) => {
          acc.totalAmount = (acc.totalAmount || 0) + Number(r.amount);
          acc.totalAdvance = (acc.totalAdvance || 0) + Number(r.advance);
          acc.totalRemaining = (acc.totalRemaining || 0) + Number(r.remaining);
          return acc;
        }, {});

        summary = { records: data.length, ...totals };
        break;
      }

      // ─── SALES ─────────────────────────────────────────────────
      case "sales": {
        let q = admin
          .from("sales_orders")
          .select(`id, order_number, order_date, status, total_amount, currency,
                   country_id, city_branch_id, country_branch_id,
                   customers(name), countries(name, code)`)
          .is("deleted_at", null)
          .order("order_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "order_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.order_number || r.id?.slice(0, 8),
          date: r.order_date,
          customer: r.customers?.name || "—",
          country: r.countries?.name || "—",
          amount: r.total_amount || 0,
          currency: r.currency || "USD",
          status: r.status
        }));

        summary = {
          records: data.length,
          totalAmount: data.reduce((s: number, r: any) => s + Number(r.amount), 0)
        };
        break;
      }

      // ─── PAYMENT / CASH / ROZNAMCHA ────────────────────────────
      case "payment":
      case "cash":
      case "cash-entry":
      case "roznamcha": {
        let q = admin
          .from("roznamcha_entries")
          .select(`id, type, journal_no, voucher_no, super_admin_serial_number,
                   country_transaction_serial_number, branch_transaction_serial_number,
                   entry_date, narration, status, posted_at,
                   country_id, city_branch_id, country_branch_id,
                   roznamcha_lines(debit, credit, currency)`)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        // Apply type filter for cash-specific queries
        if (parsed.reportType === "payment" || parsed.reportType === "payments") {
          q = q.eq("type", "payment");
        } else if (parsed.reportType === "cash") {
          q = q.in("type", ["cash", "cash_in", "cash_out"]);
        }

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const debit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0) ?? 0;
          const credit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0) ?? 0;
          const currency = r.roznamcha_lines?.[0]?.currency ?? "PKR";
          return {
            serial: r.super_admin_serial_number || r.country_transaction_serial_number || r.id?.slice(0, 8),
            date: r.entry_date,
            journalNo: r.journal_no,
            voucherNo: r.voucher_no,
            narration: r.narration || "—",
            debit,
            credit,
            balance: credit - debit,
            currency,
            status: r.status
          };
        });

        const totals = data.reduce((acc: any, r: any) => ({
          totalDebit: (acc.totalDebit || 0) + Number(r.debit),
          totalCredit: (acc.totalCredit || 0) + Number(r.credit)
        }), { totalDebit: 0, totalCredit: 0 });

        summary = { records: data.length, ...totals, netBalance: totals.totalCredit - totals.totalDebit };
        break;
      }

      // ─── LEDGER ──────────────────────────────────────────────
      case "ledger": {
        let q = admin
          .from("ledger_entries")
          .select(`id, entry_date, description, debit, credit, currency,
                   account_id, country_id, city_branch_id, country_branch_id,
                   accounts(name, account_no, account_type)`)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.entry_date,
          account: r.accounts?.name || "—",
          accountNo: r.accounts?.account_no || "—",
          description: r.description || "—",
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          balance: Number(r.credit || 0) - Number(r.debit || 0),
          currency: r.currency || "PKR",
          status: "posted"
        }));

        const totals = data.reduce((acc: any, r: any) => ({
          totalDebit: (acc.totalDebit || 0) + r.debit,
          totalCredit: (acc.totalCredit || 0) + r.credit
        }), { totalDebit: 0, totalCredit: 0 });

        summary = { records: data.length, ...totals, netBalance: totals.totalCredit - totals.totalDebit };
        break;
      }

      // ─── JOURNAL ─────────────────────────────────────────────
      case "journal": {
        let q = admin
          .from("journal_entries")
          .select(`id, entry_date, narration, status, reference_no,
                   country_id, city_branch_id, country_branch_id,
                   journal_lines(account_id, debit, credit, currency, description, accounts(name))`)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const totalDebit = r.journal_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0) ?? 0;
          const totalCredit = r.journal_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0) ?? 0;
          const currency = r.journal_lines?.[0]?.currency ?? "PKR";
          return {
            serial: r.reference_no || r.id?.slice(0, 8),
            date: r.entry_date,
            narration: r.narration || "—",
            totalDebit,
            totalCredit,
            currency,
            status: r.status,
            lineCount: r.journal_lines?.length ?? 0
          };
        });

        const totals = data.reduce((acc: any, r: any) => ({
          totalDebit: (acc.totalDebit || 0) + r.totalDebit,
          totalCredit: (acc.totalCredit || 0) + r.totalCredit
        }), { totalDebit: 0, totalCredit: 0 });

        summary = { records: data.length, ...totals };
        break;
      }

      // ─── LOADING (Shipping/Container) ─────────────────────────
      case "loading": {
        let q = admin
          .from("shipping_records")
          .select(`id, record_date, container_no, vessel_name, bl_number, status,
                   total_weight, currency, country_id, city_branch_id, country_branch_id,
                   customers(name), countries(name)`)
          .is("deleted_at", null)
          .order("record_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "record_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.bl_number || r.container_no || r.id?.slice(0, 8),
          date: r.record_date,
          customer: r.customers?.name || "—",
          country: r.countries?.name || "—",
          vessel: r.vessel_name || "—",
          container: r.container_no || "—",
          totalWeight: r.total_weight || 0,
          currency: r.currency || "USD",
          status: r.status
        }));

        summary = { records: data.length };
        break;
      }

      // ─── TRANSFER ─────────────────────────────────────────────
      case "transfer": {
        let q = admin
          .from("inter_branch_transfers")
          .select(`id, transfer_date, reference_no, status, amount, currency,
                   from_country_id, to_country_id, from_branch_id, to_branch_id,
                   narration`)
          .is("deleted_at", null)
          .order("transfer_date", { ascending: false });

        if (effectiveCountryId) {
          q = q.or(`from_country_id.eq.${effectiveCountryId},to_country_id.eq.${effectiveCountryId}`);
        }
        if (effectiveBranchId) {
          q = q.or(`from_branch_id.eq.${effectiveBranchId},to_branch_id.eq.${effectiveBranchId}`);
        }
        if (fromDate) q = q.gte("transfer_date", fromDate);
        if (toDate) q = q.lte("transfer_date", toDate);

        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.reference_no || r.id?.slice(0, 8),
          date: r.transfer_date,
          narration: r.narration || "—",
          amount: Number(r.amount || 0),
          currency: r.currency || "USD",
          status: r.status
        }));

        summary = {
          records: data.length,
          totalAmount: data.reduce((s: number, r: any) => s + r.amount, 0)
        };
        break;
      }

      // ─── REMAINING ─────────────────────────────────────────────
      case "remaining": {
        let q = admin
          .from("purchase_orders")
          .select(`id, po_number, po_date, total_amount, advance_paid, remaining_amount,
                   currency, status, country_id, city_branch_id, country_branch_id,
                   customers(name), countries(name)`)
          .is("deleted_at", null)
          .gt("remaining_amount", 0)
          .order("po_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "po_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.po_number || r.id?.slice(0, 8),
          date: r.po_date,
          customer: r.customers?.name || "—",
          country: r.countries?.name || "—",
          totalAmount: Number(r.total_amount || 0),
          advancePaid: Number(r.advance_paid || 0),
          remaining: Number(r.remaining_amount || 0),
          currency: r.currency || "USD",
          status: r.status
        }));

        summary = {
          records: data.length,
          totalRemaining: data.reduce((s: number, r: any) => s + r.remaining, 0)
        };
        break;
      }

      // ─── INVENTORY ─────────────────────────────────────────────
      case "inventory": {
        let q = admin
          .from("inventory_records")
          .select(`id, recorded_at, product_name, quantity, unit, warehouse_id,
                   country_id, city_branch_id,
                   warehouses(name)`)
          .is("deleted_at", null)
          .order("recorded_at", { ascending: false });

        q = applyStandardFilters(q, { dateField: "recorded_at", branchField: "country_branch_id" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.recorded_at,
          product: r.product_name || "—",
          quantity: Number(r.quantity || 0),
          unit: r.unit || "kg",
          warehouse: r.warehouses?.name || "—",
          status: "active"
        }));

        summary = {
          records: data.length,
          totalQuantity: data.reduce((s: number, r: any) => s + r.quantity, 0)
        };
        break;
      }

      // ─── USER ACTIVITY ─────────────────────────────────────────
      case "user-activity":
      case "user-activity": {
        const { data: rows } = await admin
          .from("audit_logs")
          .select("id, created_at, user_id, action, resource_type, resource_id, ip_address, user_agent")
          .order("created_at", { ascending: false })
          .limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.created_at,
          userId: r.user_id || "—",
          action: r.action || "—",
          resource: r.resource_type || "—",
          ip: r.ip_address || "—",
          status: "logged"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── EXCHANGE RATE ──────────────────────────────────────────
      case "exchange-rate":
      case "exchange-rates": {
        let q = admin
          .from("currency_rates")
          .select("id, rate_date, from_currency, to_currency, buy_rate, sell_rate, mid_rate, country_id")
          .order("rate_date", { ascending: false });

        if (fromDate) q = q.gte("rate_date", fromDate);
        if (toDate) q = q.lte("rate_date", toDate);
        if (effectiveCountryId) q = q.eq("country_id", effectiveCountryId);

        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.rate_date,
          fromCurrency: r.from_currency,
          toCurrency: r.to_currency,
          buyRate: Number(r.buy_rate || 0),
          sellRate: Number(r.sell_rate || 0),
          midRate: Number(r.mid_rate || 0),
          status: "active"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── RECEIPTS (legacy) ──────────────────────────────────────
      case "receipts": {
        let q = admin
          .from("roznamcha_entries")
          .select(`id, entry_date, journal_no, voucher_no, narration, status,
                   country_id, city_branch_id, roznamcha_lines(debit, credit, currency)`)
          .eq("type", "receipt")
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const credit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0) ?? 0;
          return {
            serial: r.journal_no || r.id?.slice(0, 8),
            date: r.entry_date,
            voucherNo: r.voucher_no,
            narration: r.narration || "—",
            amount: credit,
            currency: r.roznamcha_lines?.[0]?.currency || "PKR",
            status: r.status
          };
        });

        summary = { records: data.length, total: data.reduce((s: number, r: any) => s + r.amount, 0) };
        break;
      }

      // ─── FINANCIAL SUMMARIES ─────────────────────────────────────
      case "financial-summaries": {
        const [purchaseRes, salesRes, rozRes] = await Promise.allSettled([
          (async () => {
            let q = admin.from("purchase_orders").select("total_amount, remaining_amount").is("deleted_at", null);
            if (effectiveCountryId) q = q.eq("country_id", effectiveCountryId);
            return q;
          })(),
          (async () => {
            let q = admin.from("sales_orders").select("total_amount").is("deleted_at", null);
            if (effectiveCountryId) q = q.eq("country_id", effectiveCountryId);
            return q;
          })(),
          (async () => {
            let q = admin.from("roznamcha_entries").select("roznamcha_lines(debit, credit)").is("deleted_at", null);
            if (effectiveCountryId) q = q.eq("country_id", effectiveCountryId);
            return q;
          })()
        ]);

        const purchaseData = purchaseRes.status === "fulfilled" ? (purchaseRes.value as any).data ?? [] : [];
        const salesData = salesRes.status === "fulfilled" ? (salesRes.value as any).data ?? [] : [];
        const rozData = rozRes.status === "fulfilled" ? (rozRes.value as any).data ?? [] : [];

        const totalPurchase = purchaseData.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
        const totalRemaining = purchaseData.reduce((s: number, r: any) => s + Number(r.remaining_amount || 0), 0);
        const totalSales = salesData.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

        let totalDebit = 0;
        let totalCredit = 0;
        for (const entry of rozData) {
          for (const line of (entry.roznamcha_lines ?? [])) {
            totalDebit += Number(line.debit || 0);
            totalCredit += Number(line.credit || 0);
          }
        }

        data = [
          { serial: "FS-01", metric: "Total Sales Revenue", amount: totalSales, type: "Income", status: "confirmed" },
          { serial: "FS-02", metric: "Total Purchases & Direct Costs", amount: totalPurchase, type: "Expense", status: "confirmed" },
          { serial: "FS-03", metric: "Gross / Net Operating Balance", amount: totalSales - totalPurchase, type: totalSales >= totalPurchase ? "Surplus" : "Deficit", status: "confirmed" },
          { serial: "FS-04", metric: "Total Inward Cash / Debit Entries", amount: totalDebit, type: "Debit Flow", status: "posted" },
          { serial: "FS-05", metric: "Total Outward Cash / Credit Entries", amount: totalCredit, type: "Credit Flow", status: "posted" },
          { serial: "FS-06", metric: "Net Roznamcha Cash Position", amount: totalCredit - totalDebit, type: "Net Cash", status: "posted" },
          { serial: "FS-07", metric: "Outstanding Supplier / Order Payables", amount: totalRemaining, type: "Liability", status: "pending" }
        ];
        summary = {
          totalPurchase,
          totalSales,
          totalRemaining,
          totalDebit,
          totalCredit,
          netBalance: totalCredit - totalDebit,
          netProfit: totalSales - totalPurchase
        };
        break;
      }

      // ─── CUSTOMER ACCOUNTS ───────────────────────────────────────
      case "customer-accounts": {
        let q = admin
          .from("customers")
          .select(`id, name, customer_code, contact_person, phone, email, status,
                   country_id, city_branch_id, created_at, countries(name)`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        q = applyStandardFilters(q, { dateField: "created_at" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.customer_code || r.id?.slice(0, 8),
          date: r.created_at,
          customer: r.name || "—",
          contactPerson: r.contact_person || "—",
          phone: r.phone || "—",
          email: r.email || "—",
          country: r.countries?.name || "—",
          status: r.status || "active"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── CUSTOMER COMPANIES ──────────────────────────────────────
      case "customer-companies": {
        let q = admin
          .from("companies")
          .select(`id, name, registration_number, tax_number, country_id, is_active, created_at, countries(name)`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        q = applyStandardFilters(q, { dateField: "created_at" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.registration_number || r.id?.slice(0, 8),
          date: r.created_at,
          company: r.name || "—",
          regNo: r.registration_number || "—",
          taxNo: r.tax_number || "—",
          country: r.countries?.name || "—",
          status: r.is_active ? "active" : "inactive"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── BRANCH TRANSACTIONS ─────────────────────────────────────
      case "branch-transactions": {
        let q = admin
          .from("roznamcha_entries")
          .select(`id, journal_no, voucher_no, entry_date, narration, type, status,
                   country_id, city_branch_id, country_branch_id,
                   roznamcha_lines(debit, credit, currency)`)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const debit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0) ?? 0;
          const credit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0) ?? 0;
          return {
            serial: r.journal_no || r.id?.slice(0, 8),
            date: r.entry_date,
            voucherNo: r.voucher_no || "—",
            type: r.type,
            narration: r.narration || "—",
            debit,
            credit,
            amount: Math.max(debit, credit),
            currency: r.roznamcha_lines?.[0]?.currency || "PKR",
            status: r.status
          };
        });

        summary = { records: data.length, totalAmount: data.reduce((s: number, r: any) => s + r.amount, 0) };
        break;
      }

      // ─── AUDIT LOGS ──────────────────────────────────────────────
      case "audit-logs": {
        let q = admin
          .from("audit_logs")
          .select("id, created_at, user_id, action, resource_type, resource_id, ip_address, user_agent")
          .order("created_at", { ascending: false });

        if (fromDate) q = q.gte("created_at", fromDate);
        if (toDate) q = q.lte("created_at", toDate);
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.created_at,
          userId: r.user_id || "—",
          action: r.action || "—",
          resource: r.resource_type || "—",
          reference: r.resource_id || "—",
          ip: r.ip_address || "—",
          status: "logged"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── APPROVAL WORKFLOWS ──────────────────────────────────────
      case "approval-workflows": {
        let q = admin
          .from("approval_requests")
          .select(`id, entity_type, entity_id, status, requested_by, approved_by, created_at, updated_at`)
          .order("created_at", { ascending: false });

        if (fromDate) q = q.gte("created_at", fromDate);
        if (toDate) q = q.lte("created_at", toDate);
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.id?.slice(0, 8),
          date: r.created_at,
          entityType: r.entity_type || "—",
          entityId: r.entity_id || "—",
          requestedBy: r.requested_by || "—",
          approvedBy: r.approved_by || "—",
          status: r.status || "pending"
        }));

        summary = { records: data.length };
        break;
      }

      // ─── EXPENSES ────────────────────────────────────────────────
      case "expenses": {
        let q = admin
          .from("roznamcha_entries")
          .select(`id, journal_no, voucher_no, entry_date, narration, status,
                   country_id, city_branch_id,
                   roznamcha_lines(debit, credit, currency, description)`)
          .in("type", ["expense", "payment"])
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const debit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0) ?? 0;
          return {
            serial: r.journal_no || r.id?.slice(0, 8),
            date: r.entry_date,
            voucherNo: r.voucher_no || "—",
            narration: r.narration || r.roznamcha_lines?.[0]?.description || "—",
            amount: debit,
            currency: r.roznamcha_lines?.[0]?.currency || "PKR",
            status: r.status
          };
        });

        summary = { records: data.length, totalExpense: data.reduce((s: number, r: any) => s + r.amount, 0) };
        break;
      }

      // ─── PURCHASE BOOKING / REGISTER ─────────────────────────────
      case "purchase-booking":
      case "purchase-booking-register": {
        let q = admin
          .from("purchase_orders")
          .select(`id, po_number, po_date, status, total_amount, currency, advance_paid,
                   remaining_amount, country_id, city_branch_id, country_branch_id,
                   customers(name), countries(name)`)
          .is("deleted_at", null)
          .order("po_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "po_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => ({
          serial: r.po_number || r.id?.slice(0, 8),
          date: r.po_date,
          party: r.customers?.name || "—",
          amount: Number(r.total_amount || 0),
          paid: Number(r.advance_paid || 0),
          outstanding: Number(r.remaining_amount || 0),
          currency: r.currency || "USD",
          status: r.status
        }));

        summary = {
          records: data.length,
          totalAmount: data.reduce((s: number, r: any) => s + r.amount, 0),
          totalPaid: data.reduce((s: number, r: any) => s + r.paid, 0),
          totalOutstanding: data.reduce((s: number, r: any) => s + r.outstanding, 0)
        };
        break;
      }

      // ─── DAILY COMPREHENSIVE ─────────────────────────────────────
      case "daily-comprehensive": {
        let q = admin
          .from("roznamcha_entries")
          .select(`id, journal_no, voucher_no, entry_date, narration, type, status,
                   country_id, city_branch_id,
                   roznamcha_lines(debit, credit, currency)`)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false });

        q = applyStandardFilters(q, { dateField: "entry_date" });
        const { data: rows } = await q.limit(limit);

        data = (rows ?? []).map((r: any) => {
          const debit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.debit || 0), 0) ?? 0;
          const credit = r.roznamcha_lines?.reduce((s: number, l: any) => s + Number(l.credit || 0), 0) ?? 0;
          return {
            serial: r.journal_no || r.id?.slice(0, 8),
            date: r.entry_date,
            type: r.type,
            narration: r.narration || "—",
            debit,
            credit,
            amount: Math.max(debit, credit),
            currency: r.roznamcha_lines?.[0]?.currency || "PKR",
            status: r.status
          };
        });

        summary = { records: data.length, total: data.reduce((s: number, r: any) => s + r.amount, 0) };
        break;
      }

      // ─── FALLBACK ─────────────────────────────────────────────
      default: {
        data = [];
        summary = { records: 0, note: `Report type '${parsed.reportType}' not yet implemented` };
        break;
      }
    }

    return apiOk({
      reportType: parsed.reportType,
      scope: {
        level: scope.level,
        label: scope.scopeLabel,
        enforced: {
          countryId: effectiveCountryId,
          branchId: effectiveBranchId
        }
      },
      lang: parsed.lang,
      currency: parsed.currency ?? "USD",
      data,
      summary,
      records: data.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
