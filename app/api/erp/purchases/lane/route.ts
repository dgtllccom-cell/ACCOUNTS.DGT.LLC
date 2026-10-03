export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { TRANSFER_TYPES } from "@/lib/purchases/lane-rules";
import { getRequestLanguage } from "@/lib/i18n/server";
import {
  ensureLaneFromLoadingRecord, ensureLaneFromLocalPurchase, laneStatesForLoadingRecords, listLaneLoads, transferLoads,
} from "@/lib/services/purchase-lane-service";

const uuid = z.string().uuid();

/**
 * GET  /api/erp/purchases/lane                      -> the General Purchase Lane (scope-limited; older loads join on first look)
 * GET  /api/erp/purchases/lane?loadingRecordIds=a,b -> lane state of those loading rows (Action column on the Loading page)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "read" });
    void (await getRequestLanguage(request.nextUrl.searchParams.get("lang"))); // language contract: lane rows carry codes and numbers only
    const sp = request.nextUrl.searchParams;
    const ids = (sp.get("loadingRecordIds") ?? "").split(",").map((s) => s.trim()).filter((s) => uuid.safeParse(s).success);
    if (ids.length) return apiOk({ states: await laneStatesForLoadingRecords(session, ids) });
    const data = await listLaneLoads(session, {
      status: sp.get("status") || undefined,
      q: sp.get("q") || undefined,
      purchaseOrderId: uuid.safeParse(sp.get("purchaseOrderId")).success ? sp.get("purchaseOrderId")! : undefined,
      sourceType: sp.get("sourceType") || undefined,
      sourceId: uuid.safeParse(sp.get("sourceId")).success ? sp.get("sourceId")! : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

const transferSchema = z.object({
  type: z.enum(TRANSFER_TYPES),
  countryId: uuid.nullish(),
  countryBranchId: uuid.nullish(),
  cityBranchId: uuid.nullish(),
  agentId: uuid.nullish(),
  agentName: z.string().trim().max(200).nullish(),
  userId: uuid.nullish(),
  expectedLocation: z.string().trim().max(240).nullish(),
  responsibility: z.string().trim().max(40).nullish(),
  note: z.string().trim().max(1000).nullish(),
});
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ensure"), loadingRecordId: uuid.optional(), localPurchaseId: uuid.optional() }),
  z.object({ action: z.literal("transfer"), ids: z.array(uuid).min(1).max(200), transfer: transferSchema }),
]);

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "update" });
    const body = bodySchema.parse(await request.json());
    if (body.action === "ensure") {
      const out = await withLocalPg(async (sql) => {
        if (body.loadingRecordId) return ensureLaneFromLoadingRecord(sql, body.loadingRecordId, session);
        if (body.localPurchaseId) return ensureLaneFromLocalPurchase(sql, body.localPurchaseId, session);
        return null;
      });
      return apiOk({ lane: out });
    }
    const results = await transferLoads(session, body.ids, body.transfer as never);
    await writeAuditLog({ action: "update", entityTable: "purchase_lane_loads", entityId: body.ids[0] ?? null, before: null, after: { transfer: body.transfer, ids: body.ids }, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    return apiOk({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
