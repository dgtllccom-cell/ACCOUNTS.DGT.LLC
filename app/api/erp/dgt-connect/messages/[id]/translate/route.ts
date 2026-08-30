import { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { getMessageTranslation } from "@/lib/dgt-connect/translate";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";
const LANGS = ["en", "ur", "ps", "fa", "ar"] as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const lang = (new URL(request.url).searchParams.get("lang") || auth.session.preferredLanguage || "en") as SupportedLanguage;
    if (!LANGS.includes(lang as any)) return apiError("VALIDATION", "Unsupported language", 400);

    // membership check — the caller must be a participant of the message's conversation
    const allowed = await withLocalPg(async (sql) => {
      const rows = (await sql`
        select 1
        from public.dgt_messages m
        join public.dgt_conversation_participants cp
          on cp.conversation_id = m.conversation_id and cp.user_id = ${auth.session.userId}::uuid and cp.left_at is null
        where m.id = ${id}::uuid
        limit 1
      `) as unknown as unknown[];
      return rows.length > 0;
    });
    if (!allowed) return apiError("FORBIDDEN", "Not permitted", 403);

    const translation = await getMessageTranslation(id, lang);
    return apiOk({ translation });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}
