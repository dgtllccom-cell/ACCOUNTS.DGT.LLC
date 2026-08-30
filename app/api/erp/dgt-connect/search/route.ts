import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { searchMessages } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const q = new URL(request.url).searchParams.get("q") || "";
    return apiOk({ results: await searchMessages(auth.session, q) });
  } catch (error) {
    return dgtErrorResponse(error, { results: [] });
  }
}
