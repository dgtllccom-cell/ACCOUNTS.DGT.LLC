import type { SupportedLanguage } from "@/lib/i18n/languages";
import { ERP_GLOSSARY, glossaryValue, type GlossaryDomain } from "@/lib/i18n/erp-glossary";

/**
 * AI translation tier for the Central ERP Translator.
 *
 * Sits in the resolver pipeline AFTER approved translation memory + the curated
 * business glossary + the local phrase engine, and BEFORE the crude
 * word-substitution fallback. It is only consulted for genuine free-text gaps
 * the deterministic layers could not translate cleanly — so **approved / glossary
 * terminology always wins and is never overwritten by the AI**.
 *
 * Provider-agnostic and SAFE BY DESIGN: returns null (never throws) when
 * `AI_TRANSLATE_PROVIDER` / `AI_TRANSLATE_API_KEY` are not configured, so every
 * existing caller's fallback chain keeps working unchanged until a key is added.
 *
 *   AI_TRANSLATE_PROVIDER = anthropic | openai | gemini      (default: disabled)
 *   AI_TRANSLATE_API_KEY  = <provider key>
 *   AI_TRANSLATE_MODEL    = (optional) model id override
 *
 * The system prompt injects the relevant approved glossary terms as a hard
 * constraint and forbids translating names / codes / numbers / dates.
 */

const LANG_NAME: Record<SupportedLanguage, string> = {
  en: "English", ur: "Urdu", ar: "Arabic", fa: "Persian (Farsi)", ps: "Pashto",
};

type CacheEntry = { value: string; expiresAt: number };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const ck = (t: string, s: string, d: string) => `${s}>${d}:${t}`;

export function aiTranslatorConfigured(): boolean {
  const p = (process.env.AI_TRANSLATE_PROVIDER || "").toLowerCase();
  return Boolean(process.env.AI_TRANSLATE_API_KEY) && ["anthropic", "openai", "gemini"].includes(p);
}

function glossaryConstraintBlock(domain: GlossaryDomain, target: SupportedLanguage): string {
  const rows = ERP_GLOSSARY
    .filter((e) => e.domain === domain || e.domain === "general")
    .slice(0, 60)
    .map((e) => `- "${e.en}" => "${glossaryValue(e, target)}"`);
  return rows.length ? `\nApproved ERP terminology you MUST use verbatim when the meaning matches:\n${rows.join("\n")}\n` : "";
}

function systemPrompt(source: SupportedLanguage, target: SupportedLanguage, domain: GlossaryDomain): string {
  return `You are a professional ERP / accounting translator. Translate the user's text from ${LANG_NAME[source]} to ${LANG_NAME[target]}.
Rules:
- Return ONLY the translation, nothing else — no quotes, no notes, no transliteration of untranslated words.
- Keep numbers, currency codes, account/voucher/order codes, dates and proper names EXACTLY as-is.
- Use natural, concise ${LANG_NAME[target]} business/accounting register.
- If the source is already ${LANG_NAME[target]}, return it unchanged.
${glossaryConstraintBlock(domain, target)}`;
}

async function callAnthropic(sys: string, user: string, key: string, model: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1024, system: sys, messages: [{ role: "user", content: user }] }),
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

/** Translate one string into one target language via the configured AI provider. */
export async function aiTranslate(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage,
  opts: { domain?: GlossaryDomain } = {},
): Promise<string | null> {
  const trimmed = (text ?? "").toString().trim();
  if (!trimmed || sourceLang === targetLang) return null;
  if (!aiTranslatorConfigured()) return null;

  const key = ck(trimmed, sourceLang, targetLang);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const provider = (process.env.AI_TRANSLATE_PROVIDER || "").toLowerCase();
  const apiKey = process.env.AI_TRANSLATE_API_KEY as string;
  const model = process.env.AI_TRANSLATE_MODEL
    || (provider === "anthropic" ? "claude-haiku-4-5-20251001"
      : provider === "openai" ? "gpt-4o-mini"
      : "gemini-1.5-flash");

  const sys = systemPrompt(sourceLang, targetLang, opts.domain ?? "general");
  let out: string | null = null;
  try {
    if (provider === "anthropic") out = await callAnthropic(sys, trimmed, apiKey, model);
    else if (provider === "openai") out = await callOpenAI(sys, trimmed, apiKey, model);
    else if (provider === "gemini") out = await callGemini(sys, trimmed, apiKey, model);
  } catch {
    return null;
  }

  if (!out) return null;
  // strip wrapping quotes the model sometimes adds
  out = out.replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
  if (!out || out.toLowerCase() === trimmed.toLowerCase()) return null;
  cache.set(key, { value: out, expiresAt: Date.now() + CACHE_TTL_MS });
  return out;
}

/** Translate one string into all 5 languages. Returns {} if not configured. */
export async function aiTranslateAll(
  text: string,
  sourceLang: SupportedLanguage,
  opts: { domain?: GlossaryDomain } = {},
): Promise<Partial<Record<SupportedLanguage, string>>> {
  if (!aiTranslatorConfigured()) return {};
  const langs: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];
  const out: Partial<Record<SupportedLanguage, string>> = { [sourceLang]: (text ?? "").toString().trim() };
  for (const l of langs) {
    if (l === sourceLang) continue;
    const v = await aiTranslate(text, sourceLang, l, opts);
    if (v) out[l] = v;
  }
  return out;
}
