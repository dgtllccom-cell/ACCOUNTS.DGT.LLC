export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { advanceExportStock, cancelTransfer, postCostOfSales, receiveTransfer } from "@/lib/services/goods-transfer-service";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive"), rack: z.string().optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "A reason is required.") }),
  z.object({ action: z.literal("advance"), to: z.enum(["loading", "in_transit"]) }),
  z.object({ action: z.literal("post_cost"), cogsLedgerId: z.string().uuid() }),
]);

/** Receive an In Transit warehouse transfer, or cancel/return a transfer (audited reversal movement). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    z.string().uuid().parse(id);
    const body = bodySchema.parse(await request.json());

    const result = await withLocalPg(async (sql) => {
      const [t] = await sql`
        select t.id, t.dest_country_id, p.country_id, p.country_branch_id, p.city_branch_id
        from public.goods_transfers t join public.local_purchases p on p.id = t.local_purchase_id where t.id = ${id}::uuid`;
      if (!t) throw new ApiClientError("Transfer not found.", { status: 404, code: "TRANSFER_NOT_FOUND" });
      // Receiving happens at the destination warehouse's country; everything else is the purchase's own scope.
      authorizeApiScope(session, {
        resource: "purchases", action: body.action === "post_cost" ? "post" : "update",
        countryId: body.action === "receive" ? (t.dest_country_id ?? t.country_id) : t.country_id,
        countryBranchId: body.action === "receive" ? null : t.country_branch_id,
        cityBranchId: body.action === "receive" ? null : (t.city_branch_id ?? null),
      });
      return sql.begin(async (tx) => {
        if (body.action === "receive") return receiveTransfer(tx, id, { rack: body.rack, userId: session.userId });
        if (body.action === "cancel") return cancelTransfer(tx, id, { reason: body.reason, userId: session.userId });
        if (body.action === "advance") return { transfer: await advanceExportStock(tx, { transferId: id, to: body.to, userId: session.userId }) };
        // same posting identity the purchase / sales transfer routes set for the Roznamcha triggers
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: "authenticated" })}, true)`;
        return postCostOfSales(tx, { transferId: id, cogsLedgerId: body.cogsLedgerId, userId: session.userId });
      });
    });
    if (!(result as any)?.replayed) {
      await writeAuditLog({ action: `goods_transfer_${body.action}`, entityTable: "goods_transfers", entityId: id, before: null, after: { action: body.action, ...(body as object) }, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    }
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
