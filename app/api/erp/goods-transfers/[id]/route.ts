export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { cancelTransfer, receiveTransfer } from "@/lib/services/goods-transfer-service";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive"), rack: z.string().optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "A reason is required.") }),
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
        resource: "purchases", action: "update",
        countryId: body.action === "receive" ? (t.dest_country_id ?? t.country_id) : t.country_id,
        countryBranchId: body.action === "receive" ? null : t.country_branch_id,
        cityBranchId: body.action === "receive" ? null : (t.city_branch_id ?? null),
      });
      return sql.begin(async (tx) =>
        body.action === "receive"
          ? receiveTransfer(tx, id, { rack: body.rack, userId: session.userId })
          : cancelTransfer(tx, id, { reason: body.reason, userId: session.userId }),
      );
    });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
