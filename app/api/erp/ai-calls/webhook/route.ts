import { NextRequest, NextResponse } from "next/server";
import { aiCallConfigured } from "@/lib/ai-receptionist/config";
import { getTelephonyAdapter } from "@/lib/ai-receptionist/provider";
import { openInboundCall, recordEvent, finalizeCall, resolveNumberMap } from "@/lib/ai-receptionist/service";
import { greeting, nextTurn, closing } from "@/lib/ai-receptionist/dialogue";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Telephony provider webhook for the AI Receptionist.
 *
 * DORMANT: returns 503 until AI_CALL_* is configured (Owner Action). It is a public
 * endpoint by necessity (the provider calls it) so it never touches an ErpSession —
 * every DB write it triggers is a system path into the EXISTING customer_inquiries
 * module, scoped by the resolved number map / matched customer.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!aiCallConfigured()) {
    return NextResponse.json({ error: "AI Receptionist is not configured.", ownerActionRequired: true }, { status: 503 });
  }
  const adapter = getTelephonyAdapter();
  if (!adapter) {
    return NextResponse.json({ error: "Unknown telephony provider." }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => (headers[k] = v));
  if (!adapter.verifySignature(rawBody, headers, request.nextUrl.toString())) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const notif = adapter.parseInbound(params);

  const call = await openInboundCall({
    provider: adapter.name,
    providerCallId: notif.providerCallId,
    fromE164: notif.fromE164,
    toE164: notif.toE164,
  });
  const lang = (call.language_code || "en") as SupportedLanguage;
  const map = await resolveNumberMap(notif.toE164);
  const actionUrl = request.nextUrl.origin + "/api/erp/ai-calls/webhook";
  const handoffNumber = process.env.AI_CALL_HANDOFF_NUMBER || undefined;

  await recordEvent(call.id, notif.event, { from: notif.fromE164, to: notif.toE164, speech: notif.speechText, dtmf: notif.dtmf });

  // Ringing / answered → greet + gather
  if (notif.event === "ringing" || notif.event === "answered") {
    const g = map?.greeting_override
      ? map.greeting_override
      : greeting(lang, map?.label || "our office", map?.announce_recording ?? true);
    const { body, contentType } = adapter.renderTurn(
      { say: g, gather: "speech" },
      lang,
      { actionUrl, handoffNumber },
    );
    return new NextResponse(body, { headers: { "content-type": contentType } });
  }

  // Completed → finalize + write-back into customer_inquiries
  if (notif.event === "completed") {
    await finalizeCall({
      callId: call.id,
      status: "completed",
      transcript: notif.speechText || null,
      durationSeconds: notif.durationSeconds ?? null,
      recordingUrl: notif.recordingUrl ?? null,
    });
    const { body, contentType } = adapter.renderHangup(closing(lang), lang);
    return new NextResponse(body, { headers: { "content-type": contentType } });
  }

  // Speech / DTMF turn → run the deterministic dialogue policy
  const turn = nextTurn(notif.speechText || notif.dtmf || "", { lang, entityName: map?.label || "our office" });
  await recordEvent(call.id, "intent", { intent: turn.intent, handoff: !!turn.handoff });

  if (turn.handoff) {
    await finalizeCall({ callId: call.id, status: "handed_off", intent: turn.intent, outcome: "Caller asked for a team member" });
  } else if (turn.hangup) {
    await finalizeCall({
      callId: call.id,
      status: "completed",
      intent: turn.intent,
      outcome: turn.say.slice(0, 240),
      transcript: notif.speechText || null,
    });
  }

  const { body, contentType } = adapter.renderTurn(turn, lang, { actionUrl, handoffNumber });
  return new NextResponse(body, { headers: { "content-type": contentType } });
}

/** GET is a lightweight health/status probe (safe to expose). */
export async function GET() {
  return NextResponse.json({
    service: "ai-receptionist-webhook",
    configured: aiCallConfigured(),
  });
}
