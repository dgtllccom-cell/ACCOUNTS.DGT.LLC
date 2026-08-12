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

    // Placeholder: In real implementation, would fetch from database
    const mockAccountData = {
      accountCode: "PKR-AC-001",
      accountName: "Petty Cash - Karachi",
      accountType: "Asset",
      currency: "PKR",
      openingBalance: 50000,
    };

    // Mock transaction data
    const mockTransactions = [
      {
        date: fromDate,
        description: "Opening Balance",
        reference: "OPEN",
        debit: 50000,
        credit: 0,
        balance: 50000,
      },
      {
        date: new Date(new Date(fromDate).getTime() + 86400000).toISOString().slice(0, 10),
        description: "Office Expense Reimbursement",
        reference: "EXP-001",
        debit: 0,
        credit: 2500,
        balance: 47500,
      },
      {
        date: new Date(new Date(fromDate).getTime() + 172800000).toISOString().slice(0, 10),
        description: "Cash Deposit - Customer Payment",
        reference: "DEP-001",
        debit: 15000,
        credit: 0,
        balance: 62500,
      },
    ];

    // Calculate summary
    const summary = mockTransactions.reduce(
      (acc, txn) => {
        acc.transactions += 1;
        acc.totalDebit += txn.debit;
        acc.totalCredit += txn.credit;
        return acc;
      },
      { transactions: 0, totalDebit: 0, totalCredit: 0 }
    );

    const closingBalance =
      mockAccountData.openingBalance +
      summary.totalDebit -
      summary.totalCredit;

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
        rows: mockTransactions.map((txn) => [
          txn.date,
          txn.description,
          txn.reference,
          txn.debit.toFixed(2),
          txn.credit.toFixed(2),
          txn.balance.toFixed(2),
        ]),
        summary: {
          "Account Code": mockAccountData.accountCode,
          "Account Name": mockAccountData.accountName,
          "Opening Balance": mockAccountData.openingBalance.toFixed(2),
          "Total Transactions": summary.transactions,
          "Total Debit": summary.totalDebit.toFixed(2),
          "Total Credit": summary.totalCredit.toFixed(2),
          "Closing Balance": closingBalance.toFixed(2),
        },
      },
      session,
      {
        dateRange: { from: fromDate, to: toDate },
        company: "DAMAAN Business Group",
        subtitle: `${mockAccountData.accountCode} - ${mockAccountData.accountName}`,
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
