import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadBalance } from "@/lib/services/stock-balance-report-service";
import { billSummaries, paymentRows, saleRows, stockRows, treatmentRows } from "@/lib/stock-balance/views";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  view: z.enum(["bills", "stock", "sales", "payments", "treatments"]).default("bills"),
  type: z.enum(["booking", "local"]).optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  billNo: z.string().trim().max(140).optional(),
  salesBillNo: z.string().trim().max(140).optional(),
  lotNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["available", "in_transit", "not_loaded", "sold_out", "over_sold"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(2000).default(100),
});

/**
 * Stock Balance Report: the dashboard cards (always over the WHOLE filtered scope) plus one of five views of the same data.
 * Country / company / branch scope is enforced in SQL (one scope rule); a filter can only narrow it.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse(Object.fromEntries([...sp.entries()].map(([k, v]) => [k, v === "" ? undefined : v])));
    const { view, page, limit, ...filters } = q;
    const lang = await getRequestLanguage(sp.get("lang"));
    const { bills, unlinkedSales, cards, perms, warehouses } = await loadBalance(session, { ...filters, lang });

    const rows = view === "bills" ? billSummaries(bills) : view === "stock" ? stockRows(bills) : view === "sales" ? saleRows(bills, unlinkedSales, filters) : view === "payments" ? paymentRows(bills) : treatmentRows(bills);
    const total = rows.length;
    const offset = (page - 1) * limit;
    return apiOk({
      view,
      cards,
      perms,
      warehouses,
      rows: (rows as unknown[]).slice(offset, offset + limit),
      unlinkedSalesCount: unlinkedSales.length,
      pagination: { page, limit, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
