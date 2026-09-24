import type { NextRequest } from "next/server";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { getCall } from "@/lib/ai-receptionist/service";
import { analyzeCall, getIntelligence } from "@/lib/ai-receptionist/call-intelligence";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Current Conversation Intelligence analysis for one AI call (or null if never run). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });
    const { id } = await params;
    await getRequestLanguage(req.nextUrl.searchParams.get("lang"));
    // scope check — the call must be visible to this session
    await getCall(session, id);
    const analysis = await getIntelligence(id);
    return apiOk({ analysis });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Trigger (or refresh) Conversation Intelligence analysis for one AI call. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "update" });
    const { id } = await params;
    const lang = await getRequestLanguage(req.nextUrl.searchParams.get("lang"));
    // scope check — throws NOT_FOUND if the call is outside this session's scope
    await getCall(session, id);
    const analysis = await analyzeCall(id, { lang });
    if (!analysis) return apiError("NOT_FOUND", "Call not found.", 404);
    return apiOk({ analysis, task: analysis.task });
  } catch (error) {
    return handleApiError(error);
  }
}
