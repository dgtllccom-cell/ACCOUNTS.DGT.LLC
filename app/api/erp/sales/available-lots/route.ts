import { NextRequest } from "next/server";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { getRequestLanguage } from "@/lib/i18n/server";
import { listAvailableLots, getLotDeductions, SALE_SOURCES, type SaleSource } from "@/lib/sales/available-lots";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    // any of these scopes is enough to read sellable stock
    let ok = false;
    for (const s of [
      { resource: "sales", action: "read" },
      { resource: "sales_orders", action: "read" },
      { resource: "inventory", action: "read" },
      { resource: "purchases", action: "read" },
    ] as const) {
      try {
        authorizeApiScope(session, s);
        ok = true;
        break;
      } catch {
        /* try next */
      }
    }
    if (!ok) authorizeApiScope(session, { resource: "sales", action: "read" });

    const p = request.nextUrl.searchParams;
    const source = (p.get("source") || "booking") as SaleSource;
    if (!SALE_SOURCES.includes(source)) return apiError("VALIDATION", "Unknown sale source", 400);
    const lang = await getRequestLanguage(p.get("lang"));
    const deductionsFor = p.get("deductionsFor");

    if (deductionsFor) {
      const deductions = await getLotDeductions(session, deductionsFor);
      return apiOk({ deductions });
    }

    const lots = await listAvailableLots(session, {
      source,
      q: p.get("q"),
      lang,
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ lots, source, lang });
  } catch (error) {
    return handleApiError(error);
  }
}
