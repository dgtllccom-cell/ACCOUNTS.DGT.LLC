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
      select id, transfer_type, source_country_id, source_country_branch_id, source_city_branch_id,
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

    switch (body.action) {
      case "accept":
        return apiOk(await acceptHandover({ session, transferId: id, note: body.note ?? null }));
      case "return":
        return apiOk(await returnTransferForCorrection({ session, transferId: id, reason: body.reason }));
      case "reject":
        return apiOk(await rejectInterCountryTransfer({ session, transferId: id, reason: body.reason }));
      case "resubmit":
        return apiOk(await resubmitTransfer({ session, transferId: id, narration: body.narration ?? null, remarks: body.remarks ?? null }));
      case "complete":
        return apiOk(await completeHandover({ session, transferId: id, note: body.note ?? null }));
      default:
        throw new ApiClientError("Unknown action.", { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
