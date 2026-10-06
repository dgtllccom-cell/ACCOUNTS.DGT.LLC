/**
 * Conversation Intelligence — optional AI enrichment tier.
 *
 * Structural copy of lib/document-intelligence/contract-intelligence-ai.ts.
 * Gated on the SAME provider-agnostic credential already used across this
 * codebase (lib/i18n/ai-translation-client.ts) — AI_TRANSLATE_PROVIDER /
 * AI_TRANSLATE_API_KEY / AI_TRANSLATE_MODEL. Not a new credential.
 *
 * SAFE BY DESIGN: returns null on anything unconfigured, any provider error,
 * or any non-parseable response — the caller (call-intelligence.ts) MUST
 * fall back cleanly to the deterministic tier's result.
 *
 * STRICTER than the contract-intelligence template: this tier may only
 * produce narrative text (summary, next_best_action) and refine sentiment
 * nuance for non-English transcripts. It can NEVER invent a signal the
 * deterministic tier did not find, can NEVER set or alter a payment-promise
 * amount/date (those are regex-extracted from real transcript text only, in
 * call-intelligence-rules.ts), and may only RAISE — never lower — a
 * deterministic risk_level/urgency_level. This keeps "never fabricate a
 * financial figure" and "evidence from the actual transcript" airtight even
 * when the AI tier is enabled.
 */

import { aiTranslatorConfigured } from "@/lib/i18n/ai-translation-client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { SignalType } from "./call-intelligence-rules";

const LANG_NAME: Record<SupportedLanguage, string> = {
  en: "English", ur: "Urdu", ar: "Arabic", fa: "Persian (Farsi)", ps: "Pashto",
};

const RISK_RANK: Record<"low" | "medium" | "high", number> = { low: 0, medium: 1, high: 2 };

export type DeterministicSignalFinding = { type: SignalType; present: boolean; evidence: string | null };

export type CallAiEnrichment = {
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  riskLevel: "high" | "medium" | "low";
  urgencyLevel: "high" | "medium" | "low";
  summary: string;
  nextBestAction: string;
  signalExplanations: Array<{ type: string; explanation: string }>;
};

function systemPrompt(lang: SupportedLanguage): string {
  const langName = LANG_NAME[lang] || "English";
  return `You are a conversation-intelligence analyst for a business ERP system. You will be given the transcript of a real customer phone call and a list of signals already deterministically detected as present or absent.

Write every free-text value in the JSON below ("summary", "nextBestAction", "explanation") in ${langName}. Keep type/enum values in English.

Return ONLY one JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "riskLevel": "high" | "medium" | "low",
  "urgencyLevel": "high" | "medium" | "low",
  "summary": "two or three sentence plain-language summary of the call",
  "nextBestAction": "one concrete, specific recommended next action for the assigned staff member",
  "signalExplanations": [ { "type": "<one of the provided signal types that is PRESENT>", "explanation": "why this signal matters here, in plain language, grounded in the transcript" } ]
}

Rules:
- Only include a signal in "signalExplanations" if it was marked present in the deterministic findings you were given — do not invent a signal presence the deterministic scan did not find.
- Base sentiment/risk/urgency on the actual transcript text provided, not generic assumptions.
- Never invent monetary amounts, dates, or commitments not present in the text — those are handled separately.
- If the transcript is too short or unclear to analyze meaningfully, say so plainly in the summary and return riskLevel "medium".`;
}

function userPrompt(input: { transcript: string; signalFindings: DeterministicSignalFinding[]; intent: string | null }): string {
  const findings = input.signalFindings.map((f) => `- ${f.type}: ${f.present ? "PRESENT" : "not found"}${f.evidence ? ` (evidence: "${f.evidence}")` : ""}`).join("\n");
  const text = input.transcript.slice(0, 8000);
  return `Call intent: ${input.intent || "unknown"}\n\nDeterministically detected signals:\n${findings}\n\nCall transcript:\n"""\n${text}\n"""`;
}

async function callAnthropic(sys: string, user: string, key: string, model: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1536, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const txt = j?.content?.[0]?.text;
  return typeof txt === "string" ? txt.trim() : null;
}

async function callOpenAI(sys: string, user: string, key: string, model: string): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.1, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const txt = j?.choices?.[0]?.message?.content;
  return typeof txt === "string" ? txt.trim() : null;
}

async function callGemini(sys: string, user: string, key: string, model: string): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof txt === "string" ? txt.trim() : null;
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function isValidEnrichment(v: any): v is CallAiEnrichment {
  return v
    && typeof v === "object"
    && ["positive", "neutral", "negative", "frustrated"].includes(v.sentiment)
    && ["high", "medium", "low"].includes(v.riskLevel)
    && ["high", "medium", "low"].includes(v.urgencyLevel)
    && typeof v.summary === "string"
    && typeof v.nextBestAction === "string"
    && Array.isArray(v.signalExplanations);
}

/** Optional AI enrichment for one call's conversation-intelligence analysis. Never the source of a fact — see file header. */
export async function aiAnalyzeCall(input: {
  transcript: string;
  signalFindings: DeterministicSignalFinding[];
  intent: string | null;
  lang?: SupportedLanguage;
  deterministicRiskLevel: "high" | "medium" | "low";
  deterministicUrgencyLevel: "high" | "medium" | "low";
}): Promise<CallAiEnrichment | null> {
  if (!aiTranslatorConfigured()) return null;
  if (!input.transcript || input.transcript.replace(/\s/g, "").length < 10) return null;

  const provider = (process.env.AI_TRANSLATE_PROVIDER || "").toLowerCase();
  const apiKey = process.env.AI_TRANSLATE_API_KEY as string;
  const model = process.env.AI_TRANSLATE_MODEL
    || (provider === "anthropic" ? "claude-haiku-4-5-20251001"
      : provider === "openai" ? "gpt-4o-mini"
      : "gemini-1.5-flash");

  const sys = systemPrompt(input.lang || "en");
  const user = userPrompt(input);

  let out: string | null = null;
  try {
    if (provider === "anthropic") out = await callAnthropic(sys, user, apiKey, model);
    else if (provider === "openai") out = await callOpenAI(sys, user, apiKey, model);
    else if (provider === "gemini") out = await callGemini(sys, user, apiKey, model);
  } catch {
    return null;
  }
  if (!out) return null;

  try {
    const parsed = JSON.parse(stripJsonFences(out));
    if (!isValidEnrichment(parsed)) return null;

    // Never let the AI report a signal as present that the deterministic scan did not find.
    const presentTypes = new Set(input.signalFindings.filter((f) => f.present).map((f) => f.type));
    parsed.signalExplanations = parsed.signalExplanations.filter((e) => presentTypes.has(e.type as SignalType));

    // May only RAISE, never lower, the deterministic risk/urgency level.
    if (RISK_RANK[parsed.riskLevel] < RISK_RANK[input.deterministicRiskLevel]) parsed.riskLevel = input.deterministicRiskLevel;
    if (RISK_RANK[parsed.urgencyLevel] < RISK_RANK[input.deterministicUrgencyLevel]) parsed.urgencyLevel = input.deterministicUrgencyLevel;

    return parsed;
  } catch {
    return null;
  }
}
