import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import { listLoadingConsignments, listTransferWarehouses } from "@/lib/consignment/loading-consignment-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/consignment/loadings
 * Every saved loading of Purchase Booking and Local Purchase, as consignment rows (derived — never re-entered),
 * with transferred / available balance, transfer history, and the warehouses a transfer may go to.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const { rows, summary } = await listLoadingConsignments(session, {
      source: p.get("source"),
      q: p.get("q"),
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    const countryIds = [...new Set(rows.map((r) => r.countryId).filter(Boolean) as string[])];
    const warehousesRaw = (await listTransferWarehouses(session, countryIds.length ? countryIds : session.countryIds ?? [])) as any[];
    const warehouses = await localizeRecordFields(warehousesRaw, "warehouses", ["warehouse_name"], lang).catch(() => warehousesRaw);
    return apiOk({ rows, summary, warehouses, lang });
  } catch (error) {
    return handleApiError(error);
  }
}

