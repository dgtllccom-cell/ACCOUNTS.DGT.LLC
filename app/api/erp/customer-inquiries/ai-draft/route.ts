import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { aiDraft } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().trim().min(4).max(16000) });

/**
 * AI voice/text entry → structured draft for Preview/Confirm.
 * The client sends either the typed notes or the SpeechRecognition transcript;
 * a 100% local heuristic extractor returns the structured fields + any
 * unmatched fields + possible existing-customer matches. Nothing is saved here.
 */
export async function POST(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Provide the meeting text.", 400, parsed.error.flatten());
    const draft = await aiDraft(auth.session, parsed.data.text);
    return apiOk({ draft });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
