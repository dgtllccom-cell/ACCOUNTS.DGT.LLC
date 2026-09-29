import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { setEmployeeWps } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  personId: z.string().trim().max(20).nullish(),
  routingCode: z.string().trim().max(12).nullish(),
  iban: z.string().trim().max(40).nullish(),
  establishmentId: z.string().uuid().nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardWps("write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiOk(await setEmployeeWps(session, id, bodySchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
