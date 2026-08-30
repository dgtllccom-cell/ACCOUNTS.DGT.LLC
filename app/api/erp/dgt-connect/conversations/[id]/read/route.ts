import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { markRead } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    await markRead(auth.session, id);
    return apiOk({ ok: true });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}
