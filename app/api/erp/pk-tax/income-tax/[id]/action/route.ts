import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { actOnReturn } from "@/lib/services/pk-income-tax-service";

export const dynamic = "force-dynamic";

/** Workflow. review / file / pay need the Pakistan tax filing permission; filing only RECORDS the FBR/IRIS reference. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const b = z.object({
      action: z.enum(["start", "ready", "review", "back", "file", "pay", "cancel"]),
      reference: z.string().trim().max(120).nullish(),
      amount: z.number().nullish(),
      reason: z.string().trim().max(1000).nullish(),
    }).parse(await request.json());
    const { session, scope } = await guardPkTax(["review", "file", "pay"].includes(b.action) ? "file" : "write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiOk(await actOnReturn(session, scope, id, b.action, b));
  } catch (error) {
    return handleApiError(error);
  }
}
