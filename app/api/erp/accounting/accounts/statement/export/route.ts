import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import {
  buildProfessionalReportLayout,
  reportLayoutToHtml,
  reportLayoutToCsv,
  reportLayoutToExcelHtml,
} from "@/lib/reports/professional-report-generator";
import { ledgerReportService } from "@/lib/services/ledger-report-service";

const querySchema = z.object({
  accountId: uuidSchema,
  format: z.enum(["json", "html", "csv", "excel"]).default("json"),
  fromDate: z.string().trim().min(8).optional(),
  toDate: z.string().trim().min(8).optional(),
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
    const query = querySchema.parse({
      accountId: request.nextUrl.searchParams.get("accountId") ?? undefined,
      format: request.nextUrl.searchParams.get("format") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
    });

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
    });

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();

    // Real account statement — resolved from the ledger report service (scope-enforced).
    const { header, lines, openingBalance = 0 } = await ledgerReportService.getLedgerStatement({
      session,
      ledgerId: [query.accountId],
      fromDate,
      toDate,
      limit: 5000,
      language: "en",
    });

    const totalDebit = lines.reduce((t, l) => t + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((t, l) => t + Number(l.credit || 0), 0);
    const closingBalance = lines.length
      ? Number(lines[lines.length - 1]!.runningBalance || 0)
      : openingBalance;

    const accountCode = header?.accountCode || "—";
    const accountName = header?.accountName || header?.ledgerName || "—";
    const brandCompany = header?.companyName || header?.countryName || "";

    // Build report layout
    const report = buildProfessionalReportLayout(
      "Account Statement",
      {
        headers: [
          "Date",
          "Description",
          "Reference",
          "Debit",
          "Credit",
          "Balance",
        ],
        rows: lines.map((l) => [
          String(l.entryDate || "").slice(0, 10),
          l.description || "—",
          l.referenceNo || "—",
          Number(l.debit || 0).toFixed(2),
          Number(l.credit || 0).toFixed(2),
          Number(l.runningBalance || 0).toFixed(2),
        ]),
        summary: {
          "Account Code": accountCode,
          "Account Name": accountName,
          "Opening Balance": openingBalance.toFixed(2),
          "Total Transactions": lines.length,
          "Total Debit": totalDebit.toFixed(2),
          "Total Credit": totalCredit.toFixed(2),
          "Closing Balance": closingBalance.toFixed(2),
        },
      },
      session,
      {
        dateRange: { from: fromDate, to: toDate },
        company: brandCompany,
        subtitle: `${accountCode} - ${accountName}`,
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
            'attachment; filename="account-statement.csv"',
        },
      });
    } else if (query.format === "excel") {
      return new Response(reportLayoutToExcelHtml(report), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="account-statement.xls"',
        },
      });
    } else {
      return apiOk({ report });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
