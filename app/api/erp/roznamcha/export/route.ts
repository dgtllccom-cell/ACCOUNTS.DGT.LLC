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

    // Placeholder: In real implementation, would fetch from database
    // This demonstrates the structure for actual implementation
    const mockRoznamchaData = [
      {
        date: fromDate,
        description: "Opening Balance",
        debit: 0,
        credit: 10000,
        balance: 10000,
        exchangeRate: 1.0,
      },
      {
        date: new Date(new Date(fromDate).getTime() + 86400000).toISOString().slice(0, 10),
        description: "Cash Sale",
        debit: 5000,
        credit: 0,
        balance: 15000,
        exchangeRate: 1.0,
      },
      {
        date: new Date(new Date(fromDate).getTime() + 172800000).toISOString().slice(0, 10),
        description: "Purchase - USD 100 @ rate 280",
        debit: 0,
        credit: 28000,
        balance: -13000,
        exchangeRate: 280.0,
      },
    ];

    // Filter by search if provided
    const filteredData = query.search
      ? mockRoznamchaData.filter(
          (r) =>
            r.description.toLowerCase().includes(query.search!.toLowerCase()) ||
            r.date.includes(query.search!)
        )
      : mockRoznamchaData;

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
        company: "DAMAAN Business Group",
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
