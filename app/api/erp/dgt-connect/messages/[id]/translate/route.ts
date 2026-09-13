import { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { getMessageTranslation } from "@/lib/dgt-connect/translate";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang") || auth.session.preferredLanguage);

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
