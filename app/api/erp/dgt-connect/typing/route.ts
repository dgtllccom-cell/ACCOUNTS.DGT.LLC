import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { setTyping } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

const schema = z.object({ conversationId: z.string().uuid().nullable() });

export async function POST(request: NextRequest) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400);
    await setTyping(auth.session, parsed.data.conversationId);
    return apiOk({ ok: true });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}
