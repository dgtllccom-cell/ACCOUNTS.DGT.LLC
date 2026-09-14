/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic Accept / Return for Correction / Reject / Resubmit / Complete
// actions for the Main Transfer & Handover Center — one route, one action
// dispatcher, reused by every non-financial transfer_type. A financial_claim
// row still goes through the existing ledger-posting accept flow at
// /api/erp/accounting/inter-country-transfers/[id] (untouched).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import {
  acceptHandover,
  completeHandover,
  rejectInterCountryTransfer,
  resubmitTransfer,
  returnTransferForCorrection,
} from "@/lib/services/inter-country-transfer-service";
// Phase 2 sync hook: after a shipping-handover-type transfer changes status,
// mirror that onto its originating clearing_customer_order_legs row (stage,
// responsible branch/user) so the Transfer Center and the operational leg
// never drift apart. A no-op for every other transfer_type/source_table.
import { syncLegFromTransferAction } from "@/lib/services/clearing-order-workflow-service";

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), note: z.string().trim().max(2000).nullish() }),
  z.object({ action: z.literal("return"), reason: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("resubmit"), narration: z.string().trim().max(2000).nullish(), remarks: z.string().trim().max(2000).nullish() }),
  z.object({ action: z.literal("complete"), note: z.string().trim().max(2000).nullish() }),
]);

async function loadForScopeCheck(id: string) {
  return withLocalPg(async (sql) => {
    const r = await sql`
      select id, transfer_type, source_table, source_id, source_country_id, source_country_branch_id, source_city_branch_id,
             dest_country_id, dest_country_branch_id, dest_city_branch_id
      from public.inter_country_transfers
      where id = ${id} and deleted_at is null
      limit 1`;
    return r[0] ?? null;
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());

    const row = await loadForScopeCheck(id);
    if (!row) throw new ApiClientError("Transfer/handover not found.", { status: 404 });
    if (row.transfer_type === "financial_claim") {
      throw new ApiClientError(
        "This is a financial claim — accept/reject it from Inter-Country Transfers & Claims, which posts through the ledger.",
        { status: 409, code: "USE_FINANCIAL_FLOW" }
      );
    }

    authorizeApiScope(session, {
      resource: "inter_branch_transfers",
      action: body.action === "accept" || body.action === "complete" ? "approve" : "create",
      // Either side of the record is an acceptable scope match for these actions —
      // approximate with an OR by trying source, falling back to destination.
    });
    const inSource =
      session.isSuperAdmin ||
      (row.source_city_branch_id && (session.cityBranchIds ?? []).includes(row.source_city_branch_id)) ||
      (row.source_country_branch_id && (session.countryBranchIds ?? []).includes(row.source_country_branch_id)) ||
      (row.source_country_id && (session.countryIds ?? []).includes(row.source_country_id));
    const inDest =
      session.isSuperAdmin ||
      (row.dest_city_branch_id && (session.cityBranchIds ?? []).includes(row.dest_city_branch_id)) ||
      (row.dest_country_branch_id && (session.countryBranchIds ?? []).includes(row.dest_country_branch_id)) ||
      (row.dest_country_id && (session.countryIds ?? []).includes(row.dest_country_id));
    if (!inSource && !inDest) {
      throw new ApiClientError("Neither the source nor destination scope of this record is allowed for this user.", { status: 403 });
    }

    let result: unknown;
    let newStatus: string | null = null;
    switch (body.action) {
      case "accept":
        result = await acceptHandover({ session, transferId: id, note: body.note ?? null });
        newStatus = "accepted";
        break;
      case "return":
        result = await returnTransferForCorrection({ session, transferId: id, reason: body.reason });
        newStatus = "returned";
        break;
      case "reject":
        result = await rejectInterCountryTransfer({ session, transferId: id, reason: body.reason });
        newStatus = "rejected";
        break;
      case "resubmit":
        result = await resubmitTransfer({ session, transferId: id, narration: body.narration ?? null, remarks: body.remarks ?? null });
        break;
      case "complete":
        result = await completeHandover({ session, transferId: id, note: body.note ?? null });
        newStatus = "completed";
        break;
      default:
        throw new ApiClientError("Unknown action.", { status: 400 });
    }

    if (newStatus) {
      try {
        await syncLegFromTransferAction(session, {
          id: row.id,
          source_table: row.source_table ?? null,
          source_id: row.source_id ?? null,
          status: newStatus,
          dest_country_branch_id: row.dest_country_branch_id ?? null,
          dest_city_branch_id: row.dest_city_branch_id ?? null,
        });
      } catch {
        // the transfer action itself already succeeded; a sync failure must not undo it
      }
    }

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
