import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { confirmRates } from "@/lib/services/pk-income-tax-service";

export const dynamic = "force-dynamic";

/**
 * A real Pakistani tax accountant explicitly confirms the rate this return
 * used is correct for the tax year/company type before the return can be
 * marked ready for review. Requires the filing permission (same tier as
 * review/file/pay) — this is a compliance sign-off, not a routine edit.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardPkTax("file");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    return apiOk(await confirmRates(session, scope, id));
  } catch (error) {
    return handleApiError(error);
  }
}
