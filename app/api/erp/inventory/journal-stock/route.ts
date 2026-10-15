import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { loadStockJournal } from "@/lib/services/stock-journal-service";

export const dynamic = "force-dynamic";

const STAGES = ["all", "booking", "confirmed_booking", "transit", "receiving", "ready", "available", "reserved", "sold"] as const;
const DESTS = ["warehouse", "local_sales", "export", "direct_sale"] as const;

const querySchema = z.object({
  stage: z.enum(STAGES).default("all"),
  destination: z.enum(DESTS).optional(),
  view: z.enum(["rows", "available"]).default("rows"),
  search: z.string().trim().max(140).optional(),
  purchaseOrderNo: z.string().trim().max(140).optional(),
  goodsName: z.string().trim().max(140).optional(),
  containerNo: z.string().trim().max(140).optional(),
  warehouseId: uuidSchema.optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(2000).default(50),
});

/**
 * Stock Journal — Booking → Loading → Receiving/Customs → Available → Sold, for Purchase Bookings and Local Purchases.
 * Country / branch scope is enforced here (one scope rule), never trusted from the query string.
 * `view=available` returns the consolidated Available / Mixed Stock report (product × warehouse, every source kept).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse(Object.fromEntries([...sp.entries()].map(([k, v]) => [k, v === "" ? undefined : v])));
    const { view, ...filters } = q;
    const lang = await getRequestLanguage(sp.get("lang"));
    const out = await loadStockJournal(session, view === "available" ? { ...filters, lang, stage: "available", page: 1, limit: 2000 } : { ...filters, lang });

    if (view === "available") {
      type Src = { bookingNo: string; sourceType: string; sourceId: string; container: string; stage: string; quantity: number; transferNo: string | null; destination: string | null; customer: string | null; transferId: string | null; loadingRecordId: string | null; canIssue: boolean; canReverse: boolean; lineKey: string };
      const groups = new Map<string, { productName: string; unit: string; warehouseId: string | null; warehouseName: string | null; countryName: string; branchName: string; available: number; reserved: number; sources: Src[] }>();
      for (const r of out.allRows) {
        const key = [r.productName.toLowerCase(), r.unit, r.warehouseId ?? "-", r.countryId ?? "-", r.cityBranchId ?? r.countryBranchId ?? "-"].join("|");
        const g = groups.get(key) ?? { productName: r.productName, unit: r.unit, warehouseId: r.warehouseId, warehouseName: r.warehouseName, countryName: r.countryName, branchName: r.branchName, available: 0, reserved: 0, sources: [] };
        if (r.stage === "reserved") g.reserved += r.quantity;
        else g.available += r.quantity;
        g.sources.push({ bookingNo: r.billNumber, sourceType: r.sourceType, sourceId: r.sourceId, container: r.truckOrContainer, stage: r.stage, quantity: r.quantity, transferNo: r.transferNo, destination: r.destinationType, customer: r.customerName, transferId: r.transferId, loadingRecordId: r.loadingRecordId, canIssue: r.canIssue, canReverse: r.canReverse, lineKey: r.lineKey });
        groups.set(key, g);
      }
      return apiOk({
        groups: [...groups.values()].sort((a, b) => a.productName.localeCompare(b.productName) || String(a.warehouseName).localeCompare(String(b.warehouseName))),
        summary: out.summary,
        warehouses: out.warehouses,
        permissions: out.permissions,
      });
    }
    const { allRows: _allRows, ...rest } = out;
    return apiOk(rest);
  } catch (error) {
    return handleApiError(error);
  }
}
