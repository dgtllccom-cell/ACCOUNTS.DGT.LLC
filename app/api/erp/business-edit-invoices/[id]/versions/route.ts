import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { getVersions } from "@/lib/business-edit-invoice/service";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    return apiOk({ versions: await getVersions(auth.session, id) });
  } catch (error) { return beiErrorResponse(error, { versions: [] }); }
}
