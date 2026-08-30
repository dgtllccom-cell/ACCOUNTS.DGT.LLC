import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/api/response";
import { getCurrentErpSession } from "@/lib/auth/session";
import { translateErp, translateErpAll, ERP_LANGS } from "@/lib/i18n/erp-translator";

export const dynamic = "force-dynamic";

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;
const DOMAINS = ["accounting", "shipping", "clearing", "banking", "tax", "hr", "crm", "purchase", "sales", "inventory", "general"] as const;

const schema = z.object({
  text: z.string().min(1).max(8000),
  sourceLang: z.enum(LANGS),
  targetLang: z.enum(LANGS).optional(),
  all: z.boolean().optional(),
  domain: z.enum(DOMAINS).optional(),
  allowExternal: z.boolean().optional(),
});

/**
 * Central 5-language ERP translation endpoint. Every client form / module calls
 * this instead of talking to Google directly, so the local approved dictionary
 * + translation memory are always consulted first and results are learned once.
 */
export async function POST(request: NextRequest) {
  const session = await getCurrentErpSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication is required", 401);
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());
    const { text, sourceLang, targetLang, all, domain, allowExternal } = parsed.data;

    if (all || !targetLang) {
      const translations = await translateErpAll(text, sourceLang, { domain, allowExternal });
      return apiOk({ sourceLang, original: text, translations });
    }
    const r = await translateErp(text, sourceLang, { targetLang, domain, allowExternal });
    return apiOk({ sourceLang, original: text, targetLang, translation: r.text, engine: r.engine, confidence: r.confidence });
  } catch (error) {
    console.error("[i18n/translate]", error instanceof Error ? error.message : error);
    return apiError("TRANSLATE_ERROR", "Translation is temporarily unavailable.", 503);
  }
}

export { ERP_LANGS };
