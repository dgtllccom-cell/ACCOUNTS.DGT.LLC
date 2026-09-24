/**
 * Contract Intelligence — optional AI enrichment tier.
 *
 * Gated on the SAME provider-agnostic credential already used by the i18n AI
 * translation tier (lib/i18n/ai-translation-client.ts) and the AI Business
 * Assistant (lib/ai/erp-assistant.ts) — AI_TRANSLATE_PROVIDER /
 * AI_TRANSLATE_API_KEY / AI_TRANSLATE_MODEL. Not a new credential: one AI
 * capability toggle for the whole app.
 *
 * This is a NEW function rather than a reuse of aiTranslate() because that
 * function is hard-wired to single-string-in/single-string-out semantics: it
 * strips wrapping quote characters from the response (would corrupt a JSON
 * object) and discards any output identical to the input (a meaningless
 * check for structured JSON). Same provider branching
 * (Anthropic / OpenAI / Gemini), same env vars, different call shape.
 *
 * SAFE BY DESIGN: returns null on anything unconfigured, any provider error,
 * or any non-parseable response — the caller (contract-intelligence.ts) MUST
 * fall back cleanly to the deterministic tier's result. The AI is only ever
 * a source of explanatory text; the deterministic tier's clause-presence
 * findings are passed in as context and are never overwritten by the AI's
 * output.
 */

import { aiTranslatorConfigured } from "@/lib/i18n/ai-translation-client";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const LANG_NAME: Record<SupportedLanguage, string> = {
  en: "English", ur: "Urdu", ar: "Arabic", fa: "Persian (Farsi)", ps: "Pashto",
};

export type DeterministicClauseFinding = {
  clauseKey: string;
  present: boolean;
  excerpt: string | null;
};

export type ContractAiEnrichment = {
  overallRiskLevel: "high" | "medium" | "low";
  riskSummary: string;
  clauses: Array<{ clauseKey: string; riskLevel: "high" | "medium" | "low"; explanation: string }>;
  obligations: Array<{ description: string; responsibleParty: string | null; dueDate: string | null }>;
  keyDates: Array<{ label: string; date: string; kind: string }>;
};

function systemPrompt(lang: SupportedLanguage): string {
  const langName = LANG_NAME[lang] || "English";
  return `You are a contract risk analyst for an ERP system. You will be given the extracted text of a real business contract (Purchase, Sales, or Employment) and a list of standard clauses that were already deterministically detected as present or absent.

Write every free-text value in the JSON below ("riskSummary", "explanation", "description") in ${langName}. Keep clauseKey values, dates and JSON keys unchanged (English/ASCII) — only the human-readable text content is translated.

Return ONLY one JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "overallRiskLevel": "high" | "medium" | "low",
  "riskSummary": "one or two sentence plain-language summary",
  "clauses": [ { "clauseKey": "<one of the provided clause keys that is PRESENT>", "riskLevel": "high"|"medium"|"low", "explanation": "why this clause's actual wording is risky or fine, in plain language" } ],
  "obligations": [ { "description": "what one party must do", "responsibleParty": "party name or role or null", "dueDate": "YYYY-MM-DD or null" } ],
  "keyDates": [ { "label": "short label", "date": "YYYY-MM-DD", "kind": "expiry"|"renewal"|"payment"|"other" } ]
}

Rules:
- Only include a clause in "clauses" if it was marked present in the deterministic findings you were given — do not invent a clause presence the deterministic scan did not find.
- Base risk levels and explanations on the actual contract text provided, not generic assumptions.
- Never invent monetary amounts, party names or dates that are not in the text.
- If the text is too short or unreadable to analyze meaningfully, return overallRiskLevel "medium" and say so plainly in riskSummary, with empty arrays.`;
}

function userPrompt(input: { fullText: string; clauseFindings: DeterministicClauseFinding[]; docTypeCode: string | null }): string {
  const findings = input.clauseFindings.map((f) => `- ${f.clauseKey}: ${f.present ? "PRESENT" : "not found"}${f.excerpt ? ` (excerpt: "${f.excerpt}")` : ""}`).join("\n");
  const text = input.fullText.slice(0, 12000); // keep prompt bounded; contract text rarely needs more for clause-level analysis
  return `Document type: ${input.docTypeCode || "unknown"}\n\nDeterministically detected clauses:\n${findings}\n\nContract text:\n"""\n${text}\n"""`;
}

async function callAnthropic(sys: string, user: string, key: string, model: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 2048, system: sys, messages: [{ role: "user", content: user }] }),
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

function isValidEnrichment(v: any): v is ContractAiEnrichment {
  return v
    && typeof v === "object"
    && ["high", "medium", "low"].includes(v.overallRiskLevel)
    && typeof v.riskSummary === "string"
    && Array.isArray(v.clauses)
    && Array.isArray(v.obligations)
    && Array.isArray(v.keyDates);
}

/** Optional AI enrichment for one contract's clause/risk analysis. Never the source of a fact — see file header. */
export async function aiAnalyzeContract(input: {
  fullText: string;
  clauseFindings: DeterministicClauseFinding[];
  docTypeCode: string | null;
  lang?: SupportedLanguage;
}): Promise<ContractAiEnrichment | null> {
  if (!aiTranslatorConfigured()) return null;
  if (!input.fullText || input.fullText.replace(/\s/g, "").length < 20) return null;

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
    // Never let the AI report a clause as present that the deterministic scan
    // did not find — filter its clause list down to confirmed-present keys.
    const presentKeys = new Set(input.clauseFindings.filter((f) => f.present).map((f) => f.clauseKey));
    parsed.clauses = parsed.clauses.filter((c) => presentKeys.has(c.clauseKey));
    return parsed;
  } catch {
    return null;
  }
}
