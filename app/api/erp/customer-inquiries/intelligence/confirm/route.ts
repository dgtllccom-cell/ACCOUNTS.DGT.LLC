import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { confirm } from "@/lib/customer-inquiry/conversation-service";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const s = z.string().trim().max(2000).nullish();
const schema = z.object({
  channel: z.enum(["meeting", "whatsapp", "email"]),
  text: z.string().min(10).max(60000),
  lang: z.string().max(5).nullish(),
  sourceRoute: z.string().max(300).nullish(),
  sourceLabel: z.string().max(300).nullish(),
  inquiry: z.object({
    mode: z.enum(["new", "existing", "none"]),
    inquiryId: z.string().uuid().nullish(),
    customerId: z.string().uuid().nullish(),
    customerName: s, companyName: s, contactPerson: s, mobile: s, whatsapp: s, email: s, businessType: s, summary: s, requirements: s,
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  }),
  tasks: z.array(z.object({
    title: z.string().trim().max(300),
    assignedTo: z.string().uuid(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    priority: z.enum(["high", "normal"]).nullish(),
    kind: z.enum(["action", "date"]),
  })).max(40),
});

/** User-approved preview → existing inquiry + existing User Tasks. Nothing is sent to anyone. */
export async function POST(request: NextRequest) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  try {
    const p = schema.safeParse(await request.json());
    if (!p.success) return apiError("VALIDATION", "Invalid request.", 400, p.error.flatten());
    const lang = await getRequestLanguage(p.data.lang ?? null);
    return apiOk({ result: await confirm(auth.session, { ...p.data, lang }) });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
