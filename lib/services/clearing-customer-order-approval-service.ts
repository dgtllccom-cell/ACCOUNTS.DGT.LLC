import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Order-level approval workflow — same transaction shape as
 * hrAttendanceLeaveService.setCorrectionStatus (SELECT ... FOR UPDATE, then a
 * single UPDATE, inside one BEGIN/COMMIT). Scope enforcement (canAccessOrder)
 * happens in the API route before this is called, matching the existing
 * GET/PATCH handlers in app/api/erp/clearing-agent/customer-order/[id]/route.ts.
 */
export async function setOrderApprovalStatus(
  orderId: string,
  action: "approve" | "reject",
  actorId: string,
  reason?: string | null
): Promise<{ id: string; status: "approved" | "rejected" }> {
  const result = await withLocalPg(async (sql) => {
    await sql`BEGIN`;
    try {
      const row = (await sql`
        SELECT id, status FROM public.clearing_customer_orders
        WHERE id = ${orderId} AND deleted_at IS NULL FOR UPDATE
      `)?.[0];
      if (!row) throw new Error("Customer order not found.");
      if (row.status !== "pending_approval") {
        throw new Error(`Order must be in pending_approval status to ${action} (currently: ${row.status}).`);
      }

      if (action === "reject") {
        await sql`
          UPDATE public.clearing_customer_orders
          SET status = 'rejected', approved_by = ${actorId}, approved_at = now(),
              rejected_reason = ${reason ?? null}, updated_at = now()
          WHERE id = ${orderId}
        `;
        await sql`COMMIT`;
        return { id: orderId, status: "rejected" as const };
      }

      await sql`
        UPDATE public.clearing_customer_orders
        SET status = 'approved', approved_by = ${actorId}, approved_at = now(),
            rejected_reason = NULL, updated_at = now()
        WHERE id = ${orderId}
      `;
      await sql`COMMIT`;
      return { id: orderId, status: "approved" as const };
    } catch (e) {
      await sql`ROLLBACK`;
      throw e;
    }
  });
  if (!result) throw new Error("Order approval needs a direct database connection.");
  return result;
}

/** Move a booked order into the approval queue (called from the order save/confirm flow). */
export async function submitOrderForApproval(orderId: string, actorId: string): Promise<void> {
  await withLocalPg(async (sql) => {
    await sql`
      UPDATE public.clearing_customer_orders
      SET status = 'pending_approval', requested_by = ${actorId}, updated_at = now()
      WHERE id = ${orderId} AND deleted_at IS NULL
    `;
  });
}
