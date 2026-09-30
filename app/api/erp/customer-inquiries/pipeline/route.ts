import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { pipelineBoard } from "@/lib/customer-inquiry/service";
import { canManageInquiries } from "@/lib/customer-inquiry/access";
import { PIPELINE_STAGES } from "@/lib/customer-inquiry/types";

export const dynamic = "force-dynamic";

/** The real sales pipeline board — every in-scope lead grouped by its real pipeline_stage. */
export async function GET(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const board = await pipelineBoard(auth.session, {
      lang,
      original: p.get("original") === "1",
      includeClosed: p.get("includeClosed") === "1",
      countryId: p.get("countryId"),
    });
    return apiOk({ board, stages: PIPELINE_STAGES, canManage: canManageInquiries(auth.session), lang });
  } catch (error) {
    const empty = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, []]));
    return inquiryErrorResponse(error, { board: empty, stages: PIPELINE_STAGES, canManage: false });
  }
}
