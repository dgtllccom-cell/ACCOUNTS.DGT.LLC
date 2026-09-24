import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramsSchema = z.object({
  module: z.enum(["purchase_order", "sales_order", "hr_employee"]),
  id: z.string().uuid(),
});

/** Current Contract Intelligence analysis for one contract (or a pending/none status if never run). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { scope } = await guardContracts("read");
    const { module, id } = paramsSchema.parse(await ctx.params);
    await getRequestLanguage(req.nextUrl.searchParams.get("lang")); // resolves viewer language for parity with other record routes; the stored analysis is returned as generated (see POST)
    const row = await contractRegisterService.get(module, id, scope);
    if (!row) return apiError("NOT_FOUND", "Contract not found in your scope.", 404);
    const analysis = await contractRegisterService.getIntelligence(module, id);
    return apiOk({ analysis });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Trigger (or refresh) Contract Intelligence analysis for one contract — generated narrative text is written in the caller's viewer language. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  try {
    const { session, scope } = await guardContracts("write");
    const { module, id } = paramsSchema.parse(await ctx.params);
    const lang = await getRequestLanguage(req.nextUrl.searchParams.get("lang"));
    const row = await contractRegisterService.get(module, id, scope);
    if (!row) return apiError("NOT_FOUND", "Contract not found in your scope.", 404);
    const analysis = await contractRegisterService.triggerIntelligence(module, id, { id: session.userId, name: session.fullName ?? null }, lang);
    return apiOk({ analysis });
  } catch (error) {
    return handleApiError(error);
  }
}
