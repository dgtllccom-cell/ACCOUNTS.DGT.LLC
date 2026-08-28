export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { purchaseLoadingBatchService, type LoadingScope } from "@/lib/services/purchase-loading-batch-service";

function scopeOf(session: any): LoadingScope {
  const global = session.isSuperAdmin || (session.roles ?? []).includes("super_admin_reports");
  return {
    isSuperAdmin: !!session.isSuperAdmin,
    countryIds: global ? null : (session.countryIds ?? []),
    countryBranchIds: global ? null : (session.countryBranchIds ?? []),
    cityBranchIds: global ? null : (session.cityBranchIds ?? []),
  };
}

const postSchema = z.object({ jobId: z.string().uuid() });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), batchId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), batchId: z.string().uuid(), reason: z.string().trim().max(2000).optional() }),
]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read" });
    const { searchParams } = new URL(request.url);
    const purchaseOrderId = searchParams.get("purchaseOrderId") || undefined;
    const scope = scopeOf(session);
    if (purchaseOrderId && searchParams.get("view") === "progress") {
      const data = await purchaseLoadingBatchService.progressForOrder(purchaseOrderId, scope);
      return apiOk({ progress: data });
    }
    const rows = await purchaseLoadingBatchService.listBatches(scope, {
      purchaseOrderId,
      status: searchParams.get("status") || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "create" });
    const body = postSchema.parse(await request.json());
    const res = await purchaseLoadingBatchService.proposeBatchFromJob(body.jobId, scopeOf(session), session.userId, session.fullName ?? null);
    return apiCreated(res);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "write" });
    const body = patchSchema.parse(await request.json());
    const scope = scopeOf(session);
    if (body.action === "confirm") {
      const res = await purchaseLoadingBatchService.confirmBatch(body.batchId, scope, session.userId, session.fullName ?? null);
      return apiOk({ result: res });
    }
    const res = await purchaseLoadingBatchService.cancelBatch(body.batchId, body.reason || "Cancelled.", scope, session.userId, session.fullName ?? null);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
