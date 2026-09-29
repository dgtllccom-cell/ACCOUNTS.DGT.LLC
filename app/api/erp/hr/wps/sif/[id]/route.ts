import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { getSif, transitionSif } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

const idSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardWps("read");
    const { id } = idSchema.parse(await ctx.params);
    return apiOk(await getSif(session, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Submission register: record what the WPS agent did with the file (the ERP does not transmit it). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardWps("write");
    const { id } = idSchema.parse(await ctx.params);
    const b = z.object({
      action: z.enum(["submit", "accept", "reject", "partially_paid", "paid", "cancel"]),
      reference: z.string().trim().max(120).nullish(),
      response: z.string().trim().max(2000).nullish(),
    }).parse(await request.json());
    return apiOk(await transitionSif(session, id, b.action, b));
  } catch (error) {
    return handleApiError(error);
  }
}
