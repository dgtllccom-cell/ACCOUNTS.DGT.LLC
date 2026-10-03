export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { DISPOSITIONS } from "@/lib/purchases/lane-rules";
import { acceptTransfer, changeStatus, chooseDisposition, getLaneLoad } from "@/lib/services/purchase-lane-service";

const idSchema = z.object({ id: z.string().uuid() });

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "read" });
    const { id } = idSchema.parse(await ctx.params);
    const data = await getLaneLoad(session, id);
    if (!data) return apiError("NOT_FOUND", "Load not found in your scope.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), to: z.string().trim().max(40), note: z.string().trim().max(500).nullish() }),
  z.object({ action: z.literal("accept"), note: z.string().trim().max(500).nullish() }),
  z.object({
    action: z.literal("disposition"),
    kind: z.enum(DISPOSITIONS),
    warehouseId: z.string().uuid().nullish(),
    goodsId: z.string().uuid().nullish(),
    nextDestination: z.string().trim().max(240).nullish(),
    note: z.string().trim().max(1000).nullish(),
  }),
]);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "update" });
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    let result: unknown;
    if (body.action === "status") result = await changeStatus(session, id, body.to, body.note);
    else if (body.action === "accept") result = await acceptTransfer(session, id, body.note);
    else result = await chooseDisposition(session, id, { kind: body.kind, warehouseId: body.warehouseId, goodsId: body.goodsId, nextDestination: body.nextDestination, note: body.note });
    await writeAuditLog({ action: "update", entityTable: "purchase_lane_loads", entityId: id, before: null, after: { request: body, result }, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    return apiOk({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
