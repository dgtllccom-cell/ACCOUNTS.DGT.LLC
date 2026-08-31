import { apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { inquiryAssignees } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const assignees = await inquiryAssignees(auth.session);
    return apiOk({ assignees });
  } catch (error) {
    return inquiryErrorResponse(error, { assignees: [] });
  }
}
