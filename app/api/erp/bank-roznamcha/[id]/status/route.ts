/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = await request.json();

    const action = body.action as "present" | "clear" | "dishonor" | "pending";
    const notes = body.notes || "";
    const reason = body.reason || "";
    const actorName = session.user.fullName || "User";
    const actorId = session.user.id;
    const nowIso = new Date().toISOString();

    const result = await withLocalPg(async (sql) => {
      // 1. Fetch current transaction record
      const rows = await sql`
        SELECT id, status, audit_trail, debit, credit, ledger_id, counter_ledger_id, particulars
        FROM public.bank_cheque_transactions
        WHERE id = ${id} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows.length) {
        throw new Error("Bank cheque transaction not found");
      }
      const current = rows[0];

      let newStatus = current.status;
      let clearedAt = null;
      let clearedBy = null;
      let dishonoredAt = null;
      let dishonoredBy = null;
      let dishonorReason = null;
      let presentedAt = null;
      let presentedBy = null;

      const trail = Array.isArray(current.audit_trail) ? [...current.audit_trail] : [];

      if (action === "clear") {
        newStatus = "cleared";
        clearedAt = nowIso;
        clearedBy = actorId;
        trail.push({
          action: "cleared",
          actor: actorName,
          actor_id: actorId,
          timestamp: nowIso,
          notes: notes || "Cheque cleared and approved"
        });
      } else if (action === "dishonor") {
        newStatus = "dishonored";
        dishonoredAt = nowIso;
        dishonoredBy = actorId;
        dishonorReason = reason || "Dishonored by bank";
        trail.push({
          action: "dishonored",
          actor: actorName,
          actor_id: actorId,
          timestamp: nowIso,
          reason: dishonorReason,
          notes: notes || "Cheque dishonored / returned"
        });
      } else if (action === "present") {
        newStatus = "pending";
        presentedAt = nowIso;
        presentedBy = actorId;
        trail.push({
          action: "presented",
          actor: actorName,
          actor_id: actorId,
          timestamp: nowIso,
          notes: notes || "Cheque presented for bank clearance"
        });
      } else if (action === "pending") {
        newStatus = "pending";
        trail.push({
          action: "status_reset",
          actor: actorName,
          actor_id: actorId,
          timestamp: nowIso,
          notes: notes || "Cheque status reset to pending"
        });
      }

      await sql`
        UPDATE public.bank_cheque_transactions
        SET
          status = ${newStatus},
          cleared_at = COALESCE(${clearedAt}, cleared_at),
          cleared_by = COALESCE(${clearedBy}, cleared_by),
          dishonored_at = COALESCE(${dishonoredAt}, dishonored_at),
          dishonored_by = COALESCE(${dishonoredBy}, dishonored_by),
          dishonor_reason = COALESCE(${dishonorReason}, dishonor_reason),
          presented_at = COALESCE(${presentedAt}, presented_at),
          presented_by = COALESCE(${presentedBy}, presented_by),
          notes = CASE WHEN ${notes} <> '' THEN ${notes} ELSE notes END,
          audit_trail = ${JSON.stringify(trail)},
          updated_at = now()
        WHERE id = ${id}
      `;

      return { success: true, status: newStatus, id };
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
