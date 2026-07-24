import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { ledgerStatementQuerySchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ledgerReportService } from "@/lib/services/ledger-report-service";
import { getRequestLanguage } from "@/lib/i18n/server";

const querySchema = ledgerStatementQuerySchema.extend({
  ledgerId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(5000).default(2000)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const language = await getRequestLanguage();
    const query = querySchema.parse({
      ledgerId: request.nextUrl.searchParams.get("ledgerId"),
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read"
    });

    const ledgerIds = query.ledgerId.split(",");

    const { header, lines, openingBalance = 0 } = await ledgerReportService.getLedgerStatement({
      session,
      ledgerId: ledgerIds,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit: query.limit,
      language
    });

    if (!header) {
      return apiOk({
        ok: true,
        found: false,
        ledgerId: query.ledgerId,
        fromDate: query.fromDate,
        toDate: query.toDate,
        header: null,
        lines: [],
        totals: {
          entries: 0,
          debit: 0,
          credit: 0,
          openingBalance: 0,
          balance: 0,
          usdDebit: 0,
          usdCredit: 0
        }
      });
    }

    const debitTotal = lines.reduce((t, l) => t + l.debit, 0);
    const creditTotal = lines.reduce((t, l) => t + l.credit, 0);
    const usdDebitTotal = lines.reduce((t, l) => t + (l.debit > 0 ? l.usdAmount : 0), 0);
    const usdCreditTotal = lines.reduce((t, l) => t + (l.credit > 0 ? l.usdAmount : 0), 0);
    const balance = lines.length ? lines[lines.length - 1]!.runningBalance : openingBalance;

    return apiOk({
      found: true,
      ledgerId: query.ledgerId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      header,
      lines,
      totals: {
        entries: lines.length,
        debit: debitTotal,
        credit: creditTotal,
        openingBalance,
        balance,
        usdDebit: usdDebitTotal,
        usdCredit: usdCreditTotal
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
