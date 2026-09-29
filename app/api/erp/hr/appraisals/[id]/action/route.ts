import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { act } from "@/lib/services/hr-appraisal-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const b = z.object({
      action: z.enum(["submit", "acknowledge", "close", "cancel", "reopen", "refresh_metrics"]),
      employeeComments: z.string().trim().max(4000).nullish(),
    }).parse(await request.json());
    return apiOk(await act(session, id, b.action, b));
  } catch (error) {
    return handleApiError(error);
  }
}
