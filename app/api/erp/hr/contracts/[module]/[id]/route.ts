import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramsSchema = z.object({
  module: z.enum(["purchase_order", "sales_order", "hr_employee"]),
  id: z.string().uuid(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { session, scope } = await guardContracts("read");
    const { module, id } = paramsSchema.parse(await ctx.params);
    const row = await contractRegisterService.get(module, id, scope);
    if (!row) return apiError("NOT_FOUND", "Contract not found in your scope.", 404);
    await contractRegisterService.recordView(module, id, session.userId, session.fullName ?? null);
    return apiOk({ contract: row });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  contractReference: z.string().trim().max(120).nullish(),
  followupNote: z.string().trim().max(2000).nullish(),
  nextActionDate: z.string().nullish(),
  nextActionNote: z.string().trim().max(2000).nullish(),
  watchStatus: z.enum(["watching", "muted", "closed"]).nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { session, scope } = await guardContracts("write");
    const { module, id } = paramsSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());

    // ownership: the follow-up is HRM-owned metadata, but the row must be in scope
    const row = await contractRegisterService.get(module, id, scope);
    if (!row) return apiError("NOT_FOUND", "Contract not found in your scope.", 404);

    await contractRegisterService.upsertFollowup({
      sourceModule: module,
      sourceId: id,
      contractReference: body.contractReference ?? row.contract_no ?? row.booking_order_no ?? null,
      countryId: row.country_id ?? null,
      countryBranchId: row.country_branch_id ?? null,
      cityBranchId: row.city_branch_id ?? null,
      followupNote: body.followupNote ?? null,
      nextActionDate: body.nextActionDate ?? null,
      nextActionNote: body.nextActionNote ?? null,
      watchStatus: body.watchStatus ?? null,
      actorId: session.userId,
      actorName: session.fullName ?? null,
    });
    const updated = await contractRegisterService.get(module, id, scope);
    return apiOk({ contract: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
