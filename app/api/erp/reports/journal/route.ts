import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { journalReportService, type JournalRegisterRow } from "@/lib/services/journal-report-service";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// Journal Reporting — single dynamic, filter-driven data endpoint. The whole point of this
// route is that KPI cards / charts / the register table can never disagree with each other: it
// fetches ONE filtered+scoped row set from journalReportService.getJournalRegister() and derives
// every card/chart/table value from that same array here, server-side, before it ever reaches
// the client. See lib/services/journal-report-service.ts for the query + scope-filtering design.

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
const querySchema = z.object({
  reportScope: z.enum(["super_admin", "country", "branch"]).default("super_admin"),
  fromDate: z.string().trim().min(8).optional(),
  toDate: z.string().trim().min(8).optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  ledgerId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  journalType: z.string().trim().max(100).optional(),
  voucherType: z.string().trim().max(100).optional(),
  currency: z.string().trim().max(10).optional(),
  createdBy: uuidSchema.optional(),
  approvedBy: uuidSchema.optional(),
  approvalStatus: z.enum(["approved", "pending"]).optional(),
  status: z.string().trim().max(30).optional(),
  drCr: z.enum(["debit", "credit"]).optional(),
  referenceNo: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(500).default(50),
  sortDir: z.enum(["asc", "desc"]).default("desc")
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const language = await getRequestLanguage();
    const sp = request.nextUrl.searchParams;
    const query = querySchema.parse({
      reportScope: sp.get("reportScope") ?? undefined,
      fromDate: sp.get("fromDate") ?? undefined,
      toDate: sp.get("toDate") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      countryBranchId: sp.get("countryBranchId") ?? undefined,
      cityBranchId: sp.get("cityBranchId") ?? undefined,
      companyId: sp.get("companyId") ?? undefined,
      ledgerId: sp.get("ledgerId") ?? undefined,
      customerId: sp.get("customerId") ?? undefined,
      journalType: sp.get("journalType") ?? undefined,
      voucherType: sp.get("voucherType") ?? undefined,
      currency: sp.get("currency") ?? undefined,
      createdBy: sp.get("createdBy") ?? undefined,
      approvedBy: sp.get("approvedBy") ?? undefined,
      approvalStatus: sp.get("approvalStatus") ?? undefined,
      status: sp.get("status") ?? undefined,
      drCr: sp.get("drCr") ?? undefined,
      referenceNo: sp.get("referenceNo") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
      sortDir: sp.get("sortDir") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null
    });

    // Clamp to what the session is actually entitled to — same pattern as
    // app/api/erp/accounting/reports/ledger/general/route.ts.
    const allowed = resolveReportScope(session).level;
    const reportScope = allowed === "global" ? query.reportScope : allowed === "country" ? "country" : "branch";

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();

    const baseFilters = {
      session,
      reportScope,
      fromDate,
      toDate,
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
      companyId: query.companyId ?? null,
      ledgerId: query.ledgerId ?? null,
      customerId: query.customerId ?? null,
      journalType: query.journalType ?? null,
      voucherType: query.voucherType ?? null,
      currency: query.currency ?? null,
      createdBy: query.createdBy ?? null,
      approvedBy: query.approvedBy ?? null,
      approvalStatus: query.approvalStatus ?? null,
      status: query.status ?? null,
      drCr: query.drCr ?? null,
      referenceNo: query.referenceNo ?? null,
      language
    } as const;

    const [rows, openingBalance] = await Promise.all([
      journalReportService.getJournalRegister(baseFilters),
      journalReportService.getOpeningBalance(baseFilters)
    ]);

    // ── Everything below reads ONLY `rows` (+ openingBalance) — the single filtered set. ──

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;
    const entryIds = new Set(rows.map((r) => r.entryId));
    const approvedEntryIds = new Set(rows.filter((r) => r.approvalStatus === "approved").map((r) => r.entryId));
    const pendingEntryIds = new Set(rows.filter((r) => r.approvalStatus === "pending").map((r) => r.entryId));

    const kpis = {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      totalJournalEntries: entryIds.size,
      approvedEntries: approvedEntryIds.size,
      pendingEntries: pendingEntryIds.size
    };

    // ── Charts — all aggregated from `rows`. ──
    function topEntries(map: Map<string, { debit: number; credit: number }>, limit = 12) {
      return [...map.entries()]
        .sort((a, b) => b[1].debit + b[1].credit - (a[1].debit + a[1].credit))
        .slice(0, limit)
        .map(([name, v]) => ({ name, debit: v.debit, credit: v.credit }));
    }
    function bucket(map: Map<string, { debit: number; credit: number }>, key: string, r: JournalRegisterRow) {
      const b = map.get(key) ?? { debit: 0, credit: 0 };
      b.debit += r.debit;
      b.credit += r.credit;
      map.set(key, b);
    }

    const byDate = new Map<string, { debit: number; credit: number }>();
    const byAccount = new Map<string, { debit: number; credit: number }>();
    const byBranch = new Map<string, { debit: number; credit: number }>();
    const byCurrency = new Map<string, { debit: number; credit: number }>();

    for (const r of rows) {
      bucket(byDate, r.date, r);
      bucket(byAccount, r.accountName || r.accountCode || "—", r);
      bucket(byBranch, r.cityBranchName || r.countryBranchName || r.countryName || "—", r);
      bucket(byCurrency, r.currency || "—", r);
    }

    const charts = {
      debitVsCredit: [
        { name: "debit", value: totalDebit },
        { name: "credit", value: totalCredit }
      ],
      movementByDate: [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, v]) => ({ date, debit: v.debit, credit: v.credit })),
      accountWise: topEntries(byAccount),
      branchWise: topEntries(byBranch),
      currencyWise: topEntries(byCurrency)
    };

    // ── Register table — paginated slice of the SAME `rows`. ──
    const sorted = [...rows].sort((a, b) => {
      const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return query.sortDir === "asc" ? cmp : -cmp;
    });
    const totalCount = sorted.length;
    const start = (query.page - 1) * query.pageSize;
    const pageRows = sorted.slice(start, start + query.pageSize);

    return apiOk({
      reportScope,
      generatedAt: new Date().toISOString(),
      filters: { ...baseFilters, session: undefined },
      kpis,
      charts,
      table: { rows: pageRows, totalCount, page: query.page, pageSize: query.pageSize },
      totals: { debit: totalDebit, credit: totalCredit, balance: closingBalance }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
