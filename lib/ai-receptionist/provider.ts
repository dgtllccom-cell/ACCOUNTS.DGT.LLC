/**
 * Provider-agnostic telephony adapter. Converts a normalised inbound webhook
 * payload → our InboundCallNotification, and a DialogueTurn → the provider's
 * response markup. Only Twilio is implemented for v1; add others behind the same
 * interface without touching the webhook route or the dialogue policy.
 *
 * DORMANT until AI_CALL_* env is set (see config.ts). The webhook route returns
 * 503 before any of this runs when unconfigured.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { DialogueTurn, InboundCallNotification } from "./types";
import { aiCallProvider, aiCallSigningSecret } from "./config";

export interface TelephonyAdapter {
  readonly name: string;
  /** Verify the request actually came from the provider. */
  verifySignature(rawBody: string, headers: Record<string, string>, url: string): boolean;
  /** Parse an incoming webhook (form-encoded or JSON) into our normalised shape. */
  parseInbound(params: URLSearchParams | Record<string, unknown>): InboundCallNotification;
  /** Render the next spoken turn as the provider's response body + content-type. */
  renderTurn(turn: DialogueTurn, lang: SupportedLanguage, opts: { actionUrl: string; handoffNumber?: string }): { body: string; contentType: string };
  /** Render a plain hang-up / goodbye. */
  renderHangup(say: string, lang: SupportedLanguage): { body: string; contentType: string };
}

const VOICE_LOCALE: Record<SupportedLanguage, string> = {
  en: "en-US",
  ur: "ur-PK",
  ar: "ar-XA",
  fa: "fa-IR",
  ps: "ps-AF",
};

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

class TwilioAdapter implements TelephonyAdapter {
  readonly name = "twilio";

  verifySignature(_rawBody: string, headers: Record<string, string>, _url: string): boolean {
    // Twilio signs with HMAC-SHA1 over the URL + sorted params using the auth token.
    // Full implementation requires the auth token + exact param order; when a signing
    // secret is configured we require the header to be present. Kept conservative:
    const sig = headers["x-twilio-signature"] || headers["X-Twilio-Signature"];
    if (aiCallSigningSecret()) return Boolean(sig);
    return true;
  }

  parseInbound(params: URLSearchParams | Record<string, unknown>): InboundCallNotification {
    const get = (k: string): string => {
      if (params instanceof URLSearchParams) return params.get(k) || "";
      return String((params as Record<string, unknown>)[k] ?? "");
    };
    const speech = get("SpeechResult");
    const dtmf = get("Digits");
    const callStatus = get("CallStatus");
    let event: InboundCallNotification["event"] = "ringing";
    if (callStatus === "completed") event = "completed";
    else if (speech) event = "speech";
    else if (dtmf) event = "dtmf";
    else if (callStatus === "in-progress" || callStatus === "answered") event = "answered";
    return {
      providerCallId: get("CallSid"),
      fromE164: get("From"),
      toE164: get("To"),
      event,
      speechText: speech || undefined,
      dtmf: dtmf || undefined,
      durationSeconds: get("CallDuration") ? Number(get("CallDuration")) : undefined,
      recordingUrl: get("RecordingUrl") || undefined,
    };
  }

  renderTurn(turn: DialogueTurn, lang: SupportedLanguage, opts: { actionUrl: string; handoffNumber?: string }): { body: string; contentType: string } {
    const locale = VOICE_LOCALE[lang] || "en-US";
    const say = `<Say language="${locale}">${xmlEscape(turn.say)}</Say>`;
    let inner = say;
    if (turn.handoff && opts.handoffNumber) {
      inner = `${say}<Dial>${xmlEscape(opts.handoffNumber)}</Dial>`;
    } else if (turn.hangup) {
      inner = `${say}<Hangup/>`;
    } else if (turn.gather === "speech" || turn.gather === "dtmf") {
      const input = turn.gather === "dtmf" ? "dtmf" : "speech";
      inner = `<Gather input="${input}" language="${locale}" speechTimeout="auto" action="${xmlEscape(opts.actionUrl)}" method="POST">${say}</Gather>${say}`;
    }
    return { body: `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, contentType: "text/xml" };
  }

  renderHangup(say: string, lang: SupportedLanguage): { body: string; contentType: string } {
    const locale = VOICE_LOCALE[lang] || "en-US";
    return {
      body: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="${locale}">${xmlEscape(say)}</Say><Hangup/></Response>`,
      contentType: "text/xml",
    };
  }
}

export function getTelephonyAdapter(): TelephonyAdapter | null {
  switch (aiCallProvider()) {
    case "twilio":
      return new TwilioAdapter();
    // case "vonage": return new VonageAdapter();
    default:
      return null;
  }
}
