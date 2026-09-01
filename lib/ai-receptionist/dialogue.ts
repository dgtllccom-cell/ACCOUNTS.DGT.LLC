/**
 * Deterministic 5-language dialogue policy for the AI Receptionist.
 *
 * A fixed intent router handles the common reasons a customer calls. It only
 * falls through to an LLM turn when AI_CALL_LLM_* is configured (see config.ts) —
 * with no LLM key it still works as a structured multilingual IVR + message taker.
 *
 * All spoken phrases come from the central dictionary (`recept.*` in lib/i18n/ui.ts,
 * all five languages) — no parallel translation object.
 */
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { CallIntent, DialogueTurn } from "./types";

// NOTE: no `\b` — JS word boundaries are ASCII-only and never match between two
// non-Latin (Arabic-script) characters, so `\b` would break UR/AR/FA/PS detection.
const KEYWORDS: Record<CallIntent, RegExp> = {
  order_status: /(order|shipment|delivery|consignment|track|status|container|بار|آرڈر|کھیپ|حالت|طلب|شحنة|سفارش|پارسل|فرمایش)/i,
  balance: /(balance|payment|invoice|outstanding|due|account|بقایا|ادائیگی|کھاتہ|حساب|رصيد|مانده|بیلنس|بیلانس)/i,
  hours: /(open|hours|timing|closed|working|اوقات|کھلا|بند|ساعات|دوام|وخت|ساعت)/i,
  address: /(address|location|where|office|branch|map|پتہ|مقام|دفتر|شاخہ|عنوان|آدرس|پته)/i,
  agent: /(agent|human|person|representative|speak to|manager|نمائندہ|انسان|بندہ|موظف|شخص|استازی|صحبت)/i,
  callback: /(call.?back|ring me|call me later|رابطہ|واپس کال|بعد میں|اتصل بي|زنگ بزن)/i,
  message: /(message|note|tell them|pass on|پیغام|نوٹ|بتائیں|رسالة|پیام)/i,
  other: /.^/,
};

export function detectIntent(speech: string): CallIntent {
  const text = (speech || "").trim();
  if (!text) return "other";
  for (const intent of ["agent", "order_status", "balance", "hours", "address", "callback", "message"] as CallIntent[]) {
    if (KEYWORDS[intent].test(text)) return intent;
  }
  return "other";
}

export function greeting(lang: SupportedLanguage, entityName: string, announceRecording: boolean): string {
  let g = t(lang, "recept.greeting", "Thank you for calling {name}. How can I help you today?").replace("{name}", entityName);
  if (announceRecording) {
    g = `${t(lang, "recept.recording_notice", "This call may be recorded for quality and record-keeping.")} ${g}`;
  }
  return g;
}

export interface DialogueContext {
  lang: SupportedLanguage;
  entityName: string;
  customerName?: string | null;
  /** resolved facts, only used for the matching intent */
  facts?: {
    orderStatusText?: string | null;
    balanceText?: string | null;
    hoursText?: string | null;
    addressText?: string | null;
  };
}

/** Given the caller's latest speech, produce the next spoken turn. */
export function nextTurn(speech: string, ctx: DialogueContext): DialogueTurn {
  const { lang } = ctx;
  const intent = detectIntent(speech);
  const who = ctx.customerName ? `${ctx.customerName}, ` : "";

  switch (intent) {
    case "agent":
      return {
        say: t(lang, "recept.handoff", "I will connect you with a team member now. Please hold."),
        handoff: true,
        intent,
      };
    case "order_status":
      return {
        say:
          who +
          (ctx.facts?.orderStatusText ||
            t(lang, "recept.order_unknown", "I could not find that order. I will note your request and a team member will call you back.")),
        gather: ctx.facts?.orderStatusText ? "speech" : "none",
        hangup: !ctx.facts?.orderStatusText,
        intent,
      };
    case "balance":
      return {
        say:
          who +
          (ctx.facts?.balanceText ||
            t(lang, "recept.balance_unknown", "I could not confirm the account balance by phone. A team member will follow up with you.")),
        gather: "none",
        hangup: !ctx.facts?.balanceText,
        intent,
      };
    case "hours":
      return {
        say: ctx.facts?.hoursText || t(lang, "recept.hours_default", "Our offices are open Saturday to Thursday, 9 AM to 5 PM."),
        gather: "speech",
        intent,
      };
    case "address":
      return {
        say:
          ctx.facts?.addressText ||
          t(lang, "recept.address_unknown", "I will send our office address to your number by message."),
        gather: "speech",
        intent,
      };
    case "callback":
      return {
        say: t(lang, "recept.callback_ack", "Noted. A team member will call you back on this number."),
        hangup: true,
        intent,
      };
    case "message":
      return {
        say: t(lang, "recept.message_prompt", "Please tell me your message now, and I will pass it to the team."),
        gather: "speech",
        intent,
      };
    default:
      return {
        say: t(
          lang,
          "recept.fallback_prompt",
          "You can ask about an order, your account balance, our office hours or address, leave a message, or ask to speak to a team member.",
        ),
        gather: "speech",
        intent: "other",
      };
  }
}

export function closing(lang: SupportedLanguage): string {
  return t(lang, "recept.closing", "Thank you for calling. Goodbye.");
}
