export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { assignLegTruckTask } from "@/lib/services/clearing-order-workflow-service";

const schema = z.object({
  truckId: z.string().uuid().nullish(),
  truckRegistrationType: z.enum(["registered", "temporary"]),
  truckNumber: z.string().trim().min(1).max(60),
  truckDriverName: z.string().trim().max(200).nullish(),
  truckDriverMobile: z.string().trim().max(40).nullish(),
  assignedUserId: z.string().uuid(),
  dueAt: z.string().trim().max(40).nullish(),
  instructions: z.string().trim().max(4000).nullish(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const session = await requireErpSession();
    const { legId } = await ctx.params;
    const body = schema.parse(await request.json());
    const result = await assignLegTruckTask(session, { legId, ...body });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
