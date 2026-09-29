import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { analyze } from "@/lib/customer-inquiry/conversation-service";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["meeting", "whatsapp", "email"]),
  text: z.string().max(60000).nullish(),
  intakeJobId: z.string().uuid().nullish(),
  lang: z.string().max(5).nullish(),
});

/** Meeting notes / WhatsApp export / email or Document Intelligence text → preview. Nothing is saved. */
export async function POST(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const p = schema.safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION", "Invalid request.", 400, p.error.flatten());
    const lang = await getRequestLanguage(p.data.lang ?? null);
    return apiOk({ analysis: await analyze(auth.session, { channel: p.data.channel, text: p.data.text, intakeJobId: p.data.intakeJobId, lang }) });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
