import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ledgerReportService } from "@/lib/services/ledger-report-service";
import {
  buildProfessionalReportLayout,
  reportLayoutToHtml,
  reportLayoutToCsv,
  reportLayoutToExcelHtml,
} from "@/lib/reports/professional-report-generator";

const querySchema = z.object({
  format: z.enum(["json", "html", "csv", "excel"]).default("json"),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
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
      format: request.nextUrl.searchParams.get("format") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId:
        request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
    });

    const fromDate = query.fromDate ?? monthStartIso();
    const toDate = query.toDate ?? todayIso();

    // Get ledger data
    const ledgerRows = await ledgerReportService.listLedgers({
      session,
      reportScope: "super_admin",
      countryId: query.countryId ?? null,
      countryBranchId: query.countryBranchId ?? null,
      cityBranchId: query.cityBranchId ?? null,
      limit: 500,
    });

    // Calculate summary
    const summary = (ledgerRows ?? []).reduce(
      (acc: any, row: any) => {
        acc.totalLedgers += 1;
        if (row.isActive) acc.activeLedgers += 1;
        else acc.inactiveLedgers += 1;
        acc.debit += parseFloat(row.debitTotal ?? 0);
        acc.credit += parseFloat(row.creditTotal ?? 0);
        acc.balance += parseFloat(row.currentBalance ?? 0);
        return acc;
      },
      {
        totalLedgers: 0,
        activeLedgers: 0,
        inactiveLedgers: 0,
        debit: 0,
        credit: 0,
        balance: 0,
      }
    );

    // Build report layout
    const report = buildProfessionalReportLayout(
      "General Ledger Report",
      {
        headers: ["Ledger Code", "Ledger Name", "Status", "Debit", "Credit", "Balance"],
        rows: (ledgerRows ?? []).map((row: any) => [
          row.ledgerCode || "",
          row.ledgerName || "",
          row.isActive ? "active" : "inactive",
          parseFloat(row.debitTotal ?? 0).toFixed(2),
          parseFloat(row.creditTotal ?? 0).toFixed(2),
          parseFloat(row.currentBalance ?? 0).toFixed(2),
        ]),
        summary: {
          "Total Ledgers": summary.totalLedgers,
          "Active Ledgers": summary.activeLedgers,
          "Total Debit": summary.debit.toFixed(2),
          "Total Credit": summary.credit.toFixed(2),
          "Net Balance": summary.balance.toFixed(2),
        },
      },
      session,
      {
        dateRange: { from: fromDate, to: toDate },
        company: "DAMAAN Business Group",
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
            'attachment; filename="general-ledger-report.csv"',
        },
      });
    } else if (query.format === "excel") {
      return new Response(reportLayoutToExcelHtml(report), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="general-ledger-report.xls"',
        },
      });
    } else {
      // Default: JSON
      return apiOk({ report });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
