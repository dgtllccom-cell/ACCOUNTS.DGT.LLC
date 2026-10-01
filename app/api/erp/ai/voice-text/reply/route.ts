import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { runErpAssistantQuery } from "@/lib/ai/erp-assistant";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Unified AI Business Assistant Voice & Text Reply Endpoint
 * Connects directly to real ERP database with strict RBAC, scope isolation,
 * public research separation, and security audit logging.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json().catch(() => ({}));
    const userMessage = String(body.userMessage || body.message || "").trim();
    const language = (body.language || session.preferredLanguage || "en") as SupportedLanguage;

    if (!userMessage) {
      return NextResponse.json(
        { ok: false, error: "Please enter or speak a message." },
        { status: 400 }
      );
    }

    const supabase = await createApiSupabaseClient();
    const result = await runErpAssistantQuery(session, supabase, {
      question: userMessage,
      lang: language,
      pageContext: body.pageContext || "ai_voice_messages"
    });

    return NextResponse.json({
      ok: true,
      reply: result.answer,
      answerType: result.answerType,
      intent: result.intent,
      scope: result.scopeLabel,
      sourceRecord: result.sourceRecord || null,
      sources: result.sources || [],
      action: result.action || null,
      refusalReason: result.refusalReason || null,
      data: result.data || null,
      timestamp: new Date().toISOString(),
      userId: session.userId
    });
  } catch (error) {
    console.error("AI reply error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process AI query" },
      { status: 400 }
    );
  }
}
