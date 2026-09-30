import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { confirmRates } from "@/lib/services/pk-sales-tax-service";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardPkTax("file");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiOk(await confirmRates(session, scope, id));
  } catch (error) {
    return handleApiError(error);
  }
}
