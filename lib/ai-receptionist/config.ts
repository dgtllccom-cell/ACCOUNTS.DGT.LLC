/**
 * AI Receptionist / Calling — environment gating.
 *
 * The whole feature is DORMANT until the owner supplies telephony credentials.
 * No secret is ever hard-coded; everything is read from process.env at call time.
 * Mirrors the self-gating pattern of lib/i18n/ai-translation-client.ts.
 */

export type AiCallProvider = "twilio" | "vonage" | "telnyx" | "plivo";

const SUPPORTED_PROVIDERS: AiCallProvider[] = ["twilio", "vonage", "telnyx", "plivo"];

export function aiCallProvider(): AiCallProvider | null {
  const p = (process.env.AI_CALL_PROVIDER || "").trim().toLowerCase();
  return (SUPPORTED_PROVIDERS as string[]).includes(p) ? (p as AiCallProvider) : null;
}

/** True only when a provider AND its account credentials are all present. */
export function aiCallConfigured(): boolean {
  const provider = aiCallProvider();
  if (!provider) return false;
  const sid = (process.env.AI_CALL_ACCOUNT_SID || "").trim();
  const token = (process.env.AI_CALL_AUTH_TOKEN || "").trim();
  const number = (process.env.AI_CALL_NUMBER || "").trim();
  return Boolean(sid && token && number);
}

/** Optional signing secret for verifying provider webhooks. */
export function aiCallSigningSecret(): string | null {
  return (process.env.AI_CALL_SIGNING_SECRET || "").trim() || null;
}

/** Optional LLM tier for free-form answers beyond the fixed intents. */
export function aiCallLlmConfigured(): boolean {
  return Boolean((process.env.AI_CALL_LLM_API_KEY || "").trim() && (process.env.AI_CALL_LLM_PROVIDER || "").trim());
}

export function aiCallStatusReport() {
  return {
    provider: aiCallProvider(),
    configured: aiCallConfigured(),
    signingSecret: Boolean(aiCallSigningSecret()),
    llmTier: aiCallLlmConfigured(),
    ownerActionRequired: aiCallConfigured()
      ? []
      : [
          "Set AI_CALL_PROVIDER (twilio|vonage|telnyx|plivo)",
          "Set AI_CALL_ACCOUNT_SID",
          "Set AI_CALL_AUTH_TOKEN",
          "Set AI_CALL_NUMBER (E.164, the answering number)",
          "Set AI_CALL_SIGNING_SECRET (webhook signature verification)",
          "Optional: AI_CALL_LLM_PROVIDER + AI_CALL_LLM_API_KEY for free-form answers",
        ],
  };
}
