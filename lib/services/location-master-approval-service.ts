import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Location approval workflow — same SELECT...FOR UPDATE + single UPDATE shape as
 * setOrderApprovalStatus (lib/services/clearing-customer-order-approval-service.ts).
 * A location only moves out of 'pending_approval' through this function.
 */
export async function setLocationApprovalStatus(
  locationId: string,
  action: "approve" | "reject",
  actorId: string,
  reason?: string | null
): Promise<{ id: string; status: "active" | "rejected" }> {
  const result = await withLocalPg(async (sql) => {
    await sql`BEGIN`;
    try {
      const row = (await sql`
        SELECT id, status FROM public.erp_locations
        WHERE id = ${locationId} AND deleted_at IS NULL FOR UPDATE
      `)?.[0];
      if (!row) throw new Error("Location not found.");
      if (row.status !== "pending_approval") {
        throw new Error(`Location must be in pending_approval status to ${action} (currently: ${row.status}).`);
      }

      if (action === "reject") {
        await sql`
          UPDATE public.erp_locations
          SET status = 'rejected', approved_by = ${actorId}, approved_at = now(),
              rejected_reason = ${reason ?? null}, updated_at = now()
          WHERE id = ${locationId}
        `;
        await sql`COMMIT`;
        return { id: locationId, status: "rejected" as const };
      }

      await sql`
        UPDATE public.erp_locations
        SET status = 'active', approved_by = ${actorId}, approved_at = now(),
            rejected_reason = NULL, updated_at = now()
        WHERE id = ${locationId}
      `;
      await sql`COMMIT`;
      return { id: locationId, status: "active" as const };
    } catch (e) {
      await sql`ROLLBACK`;
      throw e;
    }
  });
  if (!result) throw new Error("Location approval needs a direct database connection.");
  return result;
}
