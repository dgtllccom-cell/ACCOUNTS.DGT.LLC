import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { reactivationCandidates } from "@/lib/customer-inquiry/conversation-service";

export const dynamic = "force-dynamic";

/** Old / lost / stalled inquiries in the caller's inquiry scope, scored from real activity. */
export async function GET(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const q = request.nextUrl.searchParams;
    return apiOk({ candidates: await reactivationCandidates(auth.session, { days: Number(q.get("days") || 90), includeLost: q.get("lost") !== "0" }) });
  } catch (error) {
    return inquiryErrorResponse(error, { candidates: [] });
  }
}
