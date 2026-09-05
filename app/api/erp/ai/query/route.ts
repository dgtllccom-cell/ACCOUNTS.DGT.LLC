import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { runErpAssistantQuery } from "@/lib/ai/erp-assistant";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * AI Business Assistant — CLAUDE.md Master Requirement Section B.
 *
 * POST { question, lang?, fromDate?, toDate?, asOfDate? } -> { intent,
 * answer, scopeLabel, data }. Requires an authenticated ERP session and
 * reports:read permission (the same gate every report endpoint uses). The
 * actual data is fetched exclusively via lib/ai/erp-assistant.ts, which
 * only ever calls the same RBAC-scoped functions the Financial Statements
 * and Business Summary report endpoints already use — see that file's
 * header comment for the full read-only guarantee. This route, and every
 * function it calls, is pure read: no create/update/delete on any business
 * record is reachable from here. A double-submit (e.g. a fast double
 * Enter) is harmless since the endpoint has no side effects, so no
 * idempotency lock is needed — unlike the posting endpoints elsewhere in
 * the app, which use lib/api/idempotency.ts because they DO have
 * side effects.
 */
const bodySchema = z.object({
  question: z.string().min(1).max(500),
  lang: z.enum(["en", "ur", "ar", "fa", "ps"]).optional(),
  fromDate: z.string().date().optional().nullable(),
  toDate: z.string().date().optional().nullable(),
  asOfDate: z.string().date().optional().nullable()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);

    const lang: SupportedLanguage = body.lang || session.preferredLanguage || "en";
    const supabase = await createApiSupabaseClient();

    const result = await runErpAssistantQuery(session, supabase, {
      question: body.question,
      lang,
      fromDate: body.fromDate ?? null,
      toDate: body.toDate ?? null,
      asOfDate: body.asOfDate ?? null
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
