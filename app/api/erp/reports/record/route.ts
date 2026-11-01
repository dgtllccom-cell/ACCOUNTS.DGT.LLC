import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { assertCenterRead } from "@/lib/reports/report-access";
import { loadCenterRecord, RECORD_TABLES } from "@/lib/reports/center-record";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/reports/record?table=<source table>&id=<record id> - the full read-only document behind a Reports Center row (the View button).
 * reports:read is required, the record must lie inside the login's own country / branch scope and operational domain, and a record outside it
 * answers 404 (its existence is never confirmed). Read-only: this route never writes.
 */
const SHIPPING_TABLES: readonly string[] = ["clearing_customer_orders", "clearing_payment_bills", "clearing_bill_customer_charges", "customer_receipts"];
const querySchema = z.object({ table: z.enum(RECORD_TABLES), id: uuidSchema });

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse({ table: sp.get("table"), id: sp.get("id") });
    assertCenterRead(session, SHIPPING_TABLES.includes(q.table) ? "shipping" : "business");
    const doc = await loadCenterRecord(session, q.table, q.id);
    if (!doc) return apiOk({ found: false });
    return apiOk({ found: true, doc });
  } catch (error) {
    return handleApiError(error);
  }
}
