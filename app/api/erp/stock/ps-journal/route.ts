import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadPsStockJournalEndpoint } from "@/lib/services/ps-stock-journal-service";
import type { PsStockStatusFilter } from "@/lib/stock/ps-journal-model";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["", "available", "partial", "sold_out", "negative", "in_transit", "not_loaded"] as const;

const querySchema = z.object({
  mode: z.enum(["ps_journal", "booking_stock"]).default("ps_journal"),
  countryId: uuidSchema.optional(),
  branchId: z.string().trim().max(80).optional(),
  warehouseId: uuidSchema.optional(),
  goods: z.string().trim().max(180).optional(),
  origin: z.string().trim().max(120).optional(),
  lot: z.string().trim().max(160).optional(),
  purchaseBill: z.string().trim().max(140).optional(),
  salesBill: z.string().trim().max(140).optional(),
  blNo: z.string().trim().max(140).optional(),
  containerNo: z.string().trim().max(140).optional(),
  stockStatus: z.enum(STATUS_VALUES).default(""),
  dateFrom: z.string().trim().max(20).optional(),
  dateTo: z.string().trim().max(20).optional(),
  lotKey: z.string().trim().max(200).optional(),
  lotSearch: z.string().trim().max(160).optional(),
  lotDateFrom: z.string().trim().max(20).optional(),
  lotDateTo: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(25),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const rawParams = Object.fromEntries(
      [...sp.entries()].map(([k, v]) => [k, v === "" && k !== "stockStatus" ? undefined : v]),
    );
    const q = querySchema.parse(rawParams);
    const lang = await getRequestLanguage(sp.get("lang"));

    const payload = await loadPsStockJournalEndpoint(session, {
      mode: q.mode,
      filters: {
        countryId: q.countryId,
        branchId: q.branchId,
        warehouseId: q.warehouseId,
        goods: q.goods,
        origin: q.origin,
        lot: q.lot,
        purchaseBill: q.purchaseBill,
        salesBill: q.salesBill,
        blNo: q.blNo,
        containerNo: q.containerNo,
        stockStatus: q.stockStatus as PsStockStatusFilter,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      },
      lotKey: q.lotKey,
      lotSearch: q.lotSearch,
      lotDateFrom: q.lotDateFrom,
      lotDateTo: q.lotDateTo,
      page: q.page,
      limit: q.limit,
      lang,
    });

    return apiOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
