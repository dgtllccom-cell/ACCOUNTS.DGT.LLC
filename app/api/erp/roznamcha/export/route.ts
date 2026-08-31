import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import {
  buildProfessionalReportLayout,
  reportLayoutToHtml,
  reportLayoutToCsv,
  reportLayoutToExcelHtml,
} from "@/lib/reports/professional-report-generator";
import { withLocalPg } from "@/lib/db/local-postgres";

const querySchema = z.object({
  format: z.enum(["json", "html", "csv", "excel"]).default("json"),
  fromDate: z.string().trim().min(8).optional(),
  toDate: z.string().trim().min(8).optional(),
  search: z.string().max(200).optional(),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);
    const query = querySchema.parse({
      format: request.nextUrl.searchParams.get("format") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
    });

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      ...scope,
    });

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();

    // Real Roznamcha data — from roznamcha_entries + roznamcha_lines, scope-enforced.
    const cityIds = [...new Set(session.assignments.map((a) => a.cityBranchId).filter(Boolean))] as string[];
    const countryBranchIds = [...new Set(session.assignments.map((a) => a.countryBranchId).filter(Boolean))] as string[];
    const countryIds = [...new Set(session.assignments.map((a) => a.countryId).filter(Boolean))] as string[];
    const safeSearch = query.search ? query.search.replace(/[%,]/g, "") : null;

    const rows = (await withLocalPg(async (sql) => {
      if (!session.isSuperAdmin && cityIds.length === 0 && countryBranchIds.length === 0 && countryIds.length === 0) {
        return [] as any[];
      }
      return sql`
        select
          e.entry_date::text as date,
          coalesce(nullif(l.description, ''), e.narration, '') as description,
          coalesce(l.debit, 0) as debit,
          coalesce(l.credit, 0) as credit,
          coalesce(l.usd_rate, 1) as exchange_rate
        from public.roznamcha_entries e
        left join public.roznamcha_lines l on l.roznamcha_entry_id = e.id
        where e.deleted_at is null
          and (${scope.countryId ? sql`e.country_id = ${scope.countryId}` : sql`true`})
          and (${scope.countryBranchId ? sql`e.country_branch_id = ${scope.countryBranchId}` : sql`true`})
          and (${scope.cityBranchId ? sql`e.city_branch_id = ${scope.cityBranchId}` : sql`true`})
          and (${session.isSuperAdmin
            ? sql`true`
            : sql`(e.city_branch_id = any(${cityIds}) or e.country_branch_id = any(${countryBranchIds}) or e.country_id = any(${countryIds}))`})
          and e.entry_date >= ${fromDate}
          and e.entry_date <= ${toDate}
          and (${safeSearch ? sql`(e.narration ilike ${"%" + safeSearch + "%"} or l.description ilike ${"%" + safeSearch + "%"} or e.journal_no ilike ${"%" + safeSearch + "%"})` : sql`true`})
        order by e.entry_date asc, e.created_at asc
        limit 5000
      `;
    })) ?? [];

    let running = 0;
    const filteredData = (rows as any[]).map((r) => {
      const debit = Number(r.debit || 0);
      const credit = Number(r.credit || 0);
      running += debit - credit;
      return {
        date: String(r.date || "").slice(0, 10),
        description: r.description || "—",
        debit,
        credit,
        balance: running,
        exchangeRate: Number(r.exchange_rate || 1),
      };
    });

    // Calculate summary
    const summary = filteredData.reduce(
      (acc, row) => {
        acc.entries += 1;
        acc.totalDebit += row.debit;
        acc.totalCredit += row.credit;
        return acc;
      },
      { entries: 0, totalDebit: 0, totalCredit: 0 }
    );

    // Build report layout
    const report = buildProfessionalReportLayout(
      "Cash Entry / Roznamcha Report",
      {
        headers: [
          "Date",
          "Description",
          "Debit",
          "Credit",
          "Balance",
          "Exchange Rate",
        ],
        rows: filteredData.map((row) => [
          row.date,
          row.description,
          row.debit.toFixed(2),
          row.credit.toFixed(2),
          row.balance.toFixed(2),
          row.exchangeRate.toFixed(2),
        ]),
        summary: {
          "Total Entries": summary.entries,
          "Total Debit": summary.totalDebit.toFixed(2),
          "Total Credit": summary.totalCredit.toFixed(2),
        },
      },
      session,
      {
        dateRange: { from: fromDate, to: toDate },
        company: "",
        subtitle: "Daily Journal & Cash Entry with Exchange Rates",
      }
    );

    // Return in requested format
    if (query.format === "html") {
      return new Response(reportLayoutToHtml(report), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } else if (query.format === "csv") {
      return new Response(reportLayoutToCsv(report), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="roznamcha-export.csv"',
        },
      });
    } else if (query.format === "excel") {
      return new Response(reportLayoutToExcelHtml(report), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="roznamcha-export.xls"',
        },
      });
    } else {
      return apiOk({ report });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
