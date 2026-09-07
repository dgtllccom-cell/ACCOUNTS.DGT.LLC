import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireConsignmentSession, consignmentErrorResponse } from "@/lib/consignment/route-helpers";
import { transferConsignment, untransferConsignment } from "@/lib/consignment/service";

export const dynamic = "force-dynamic";

/**
 * POST   → Transfer / Confirm this consignment to Main ERP (manager only).
 * DELETE → Reverse the transfer (unlock).
 *
 * The register NEVER auto-posts. This is the ONLY endpoint that changes
 * accounting_status, and only on this explicit user action. It marks the row
 * transferred + locked and snapshots the full totals into consignment_event;
 * it does not itself write ledger / roznamcha / journal entries.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const out = await transferConsignment(auth.session, id);
    try {
      await auditApiAction(request, { action: "consignment.transfer", entityTable: "consignment", entityId: id, after: out });
    } catch {}
    return apiOk(out);
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const out = await untransferConsignment(auth.session, id);
    try {
      await auditApiAction(request, { action: "consignment.transfer.reverse", entityTable: "consignment", entityId: id, after: out });
    } catch {}
    return apiOk(out);
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}
