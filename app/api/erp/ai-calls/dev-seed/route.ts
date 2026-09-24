import { NextResponse } from "next/server";
import { isDemoAuthEnabled } from "@/lib/supabase/config";
import { requireErpSession } from "@/lib/auth/session";
import { upsertNumberMap, openInboundCall, recordEvent, finalizeCall } from "@/lib/ai-receptionist/service";
import { getIntelligence } from "@/lib/ai-receptionist/call-intelligence";

/**
 * DEV-ONLY Conversation Intelligence verification seeder.
 *
 * Gated identically to /api/erp/auth/dev-session — inert (404) unless
 * APP_ENV=development and demo auth is enabled, so it never reaches
 * staging/production. Drives the REAL internal call-lifecycle functions
 * (openInboundCall -> recordEvent -> finalizeCall) exactly as the Twilio
 * webhook route does, so the whole downstream pipeline (transcript assembly,
 * customer matching, Conversation Intelligence analysis, automatic User Task
 * creation) is exercised for real. It does NOT simulate a real telephone
 * call end-to-end — the telephony transport layer itself stays untouched and
 * is reported separately as BLOCKED BY PROVIDER SETUP.
 *
 *   POST /api/erp/ai-calls/dev-seed
 *   { fromE164, toE164, numberMapAssignedTo, turns: string[], countryId?, countryBranchId?, cityBranchId? }
 */
function devEnabled() {
  return (process.env.APP_ENV || "").toLowerCase() === "development" && isDemoAuthEnabled();
}

export async function POST(request: Request) {
  if (!devEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await requireErpSession();
  const body = await request.json().catch(() => ({} as any));

  const fromE164: string = body.fromE164;
  const toE164: string = body.toE164;
  const turns: string[] = Array.isArray(body.turns) ? body.turns : [];
  if (!fromE164 || !toE164 || !turns.length) {
    return NextResponse.json({ error: "fromE164, toE164 and turns[] are required." }, { status: 400 });
  }

  // Ensure a real number map row exists for this test number.
  const mapResult = await upsertNumberMap(session, {
    phone_e164: toE164,
    label: "DEV_SEED_NUMBER_MAP",
    country_id: body.countryId ?? null,
    country_branch_id: body.countryBranchId ?? null,
    city_branch_id: body.cityBranchId ?? null,
    purpose: "reception",
    default_language: (body.lang as any) ?? "en",
    announce_recording: true,
    assigned_to: body.numberMapAssignedTo ?? null,
    is_active: true,
  });

  const providerCallId = `dev-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const call = await openInboundCall({ provider: "dev-test", providerCallId, fromE164, toE164 });

  for (const turn of turns) {
    await recordEvent(call.id, "speech", { from: fromE164, to: toE164, speech: turn });
  }

  const result = await finalizeCall({
    callId: call.id,
    status: "completed",
    transcript: turns[turns.length - 1],
    durationSeconds: 60 * turns.length,
  });

  const analysis = await getIntelligence(call.id);

  return NextResponse.json({ ok: true, callId: call.id, numberMapId: mapResult.id, inquiryId: result.inquiryId, analysis });
}
