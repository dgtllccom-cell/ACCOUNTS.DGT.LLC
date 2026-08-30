import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, apiError } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { listMessages, sendMessage } from "@/lib/dgt-connect/service";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const dynamic = "force-dynamic";

const LANGS = ["en", "ur", "ps", "fa", "ar"] as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before") || undefined;
    const limit = Number(url.searchParams.get("limit") || 40);
    const viewerLang = (url.searchParams.get("lang") || auth.session.preferredLanguage || "en") as SupportedLanguage;
    const translate = url.searchParams.get("translate") === "1";
    const messages = await listMessages(auth.session, id, {
      before, limit, viewerLang: LANGS.includes(viewerLang as any) ? viewerLang : "en", translate,
    });
    return apiOk({ messages });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}

const sendSchema = z.object({
  body: z.string().max(8000).default(""),
  bodyLang: z.enum(LANGS).optional(),
  replyToId: z.string().uuid().nullable().optional(),
  attachment: z.object({
    name: z.string().min(1).max(255),
    mime: z.string().max(120),
    size: z.number().int().nonnegative().max(15 * 1024 * 1024),
    dataUrl: z.string().max(21_000_000).optional(),
    url: z.string().max(2000).optional(),
  }).nullable().optional(),
  sharedRecord: z.object({
    module: z.string().min(1).max(60),
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(200),
    route: z.string().max(500).optional(),
    summary: z.string().max(500).optional(),
  }).nullable().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const parsed = sendSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid message", 400, parsed.error.flatten());
    const message = await sendMessage(auth.session, id, parsed.data);
    return apiCreated({ message });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}
