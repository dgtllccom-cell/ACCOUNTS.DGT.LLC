import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { renderDocumentHtml } from "@/lib/business-edit-invoice/service";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";

/** Origin the QR code links to (the host the user is on, so a phone scan opens the live site). */
function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const lang = (await getRequestLanguage(request.nextUrl.searchParams.get("lang"))) as SupportedLanguage;
    const { html, title } = await renderDocumentHtml(auth.session, id, lang, requestOrigin(request));
    return apiOk({ html, title, lang });
  } catch (error) {
    return beiErrorResponse(error);
  }
}
