import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { acceptShippingTransfer, decideShippingTransferReject } from "@/lib/services/shipping-transfer-service";
import { uuidSchema, optionalUuidSchema } from "@/lib/api/erp-validation";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    debitLedgerId: uuidSchema,
    creditLedgerId: uuidSchema,
    note: z.string().trim().max(400).nullable().optional()
  }),
  z.object({
    action: z.literal("reject"),
    note: z.string().trim().max(400).nullable().optional()
  }),
  z.object({
    action: z.literal("return"),
    note: z.string().trim().max(400).nullable().optional()
  })
]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const transferId = uuidSchema.parse(id);
    const body = actionSchema.parse(await request.json());

    // Load the transfer's destination scope + authorize the caller on it (receiving office).
    const transfer = (await withLocalPg((sql) => sql`
      select dest_country_id, dest_country_branch_id, dest_city_branch_id, clearing_agent_id, status
        from public.shipping_expense_transfers where id = ${transferId} and deleted_at is null limit 1`))?.[0];
    if (!transfer) return handleApiError(new Error("Transfer not found"));

    authorizeApiScope(session, {
      resource: "shipping_transfers",
      action: "approve",
      countryId: transfer.dest_country_id ?? null,
      countryBranchId: transfer.dest_country_branch_id ?? null,
      cityBranchId: transfer.dest_city_branch_id ?? null
    });
    // A shipping-only login may only act on its own clearing agent's transfers.
    if (session.isShippingScoped && !(transfer.clearing_agent_id && session.clearingAgentIds.includes(transfer.clearing_agent_id))) {
      return handleApiError(new Error("Not authorized for this shipping agent's transfer"));
    }

    if (body.action === "accept") {
      const result = await acceptShippingTransfer({
        session,
        transferId,
        debitLedgerId: body.debitLedgerId,
        creditLedgerId: body.creditLedgerId,
        note: body.note ?? null
      });
      return apiOk(result);
    }
    const result = await decideShippingTransferReject({
      session,
      transferId,
      action: body.action === "return" ? "returned" : "rejected",
      note: body.note ?? null
    });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
