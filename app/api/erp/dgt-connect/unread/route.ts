import { apiOk } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { unreadSummary } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    return apiOk(await unreadSummary(auth.session));
  } catch (error) {
    return dgtErrorResponse(error, { total: 0, byConversation: {}, typing: {} });
  }
}
