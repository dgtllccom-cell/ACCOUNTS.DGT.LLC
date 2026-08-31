import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { renderDocumentHtml } from "@/lib/business-edit-invoice/service";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const lang = (await getRequestLanguage(request.nextUrl.searchParams.get("lang"))) as SupportedLanguage;
    const { html, title } = await renderDocumentHtml(auth.session, id, lang);
    return apiOk({ html, title, lang });
  } catch (error) {
    return beiErrorResponse(error);
  }
}
