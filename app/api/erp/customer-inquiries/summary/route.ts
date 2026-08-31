import { apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { inquirySummary } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const summary = await inquirySummary(auth.session);
    return apiOk({ summary });
  } catch (error) {
    return inquiryErrorResponse(error, { summary: {} });
  }
}
