import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/api/response";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { setStatus } from "@/lib/business-edit-invoice/service";
export const dynamic = "force-dynamic";
const schema = z.object({ status: z.enum(["draft", "finalized", "void"]) });
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid status", 400);
    return apiOk({ invoice: await setStatus(auth.session, id, parsed.data.status) });
  } catch (error) { return beiErrorResponse(error); }
}
