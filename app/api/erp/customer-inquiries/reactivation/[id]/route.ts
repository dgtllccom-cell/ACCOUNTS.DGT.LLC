import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { reactivate } from "@/lib/customer-inquiry/conversation-service";

export const dynamic = "force-dynamic";

/** Reactivate: inquiry → follow-up, CRM action item + note, User Task. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const p = z.object({ assignedTo: z.string().uuid(), dueDate: z.string(), note: z.string().max(2000), channel: z.string().max(20).nullish() }).safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION", "Invalid request.", 400, p.error.flatten());
    return apiOk(await reactivate(auth.session, id, p.data));
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
