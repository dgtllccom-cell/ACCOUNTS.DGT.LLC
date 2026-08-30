// Server-side only in practice (uses withLocalPg, which no-ops without DATABASE_URL).
import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { translateViaMachineTranslation } from "@/lib/i18n/machine-translation-client";
import { ERP_GLOSSARY, buildGlossaryIndex, glossaryValue, type GlossaryDomain } from "@/lib/i18n/erp-glossary";

/**
 * ── Central ERP Translation Service (EN / UR / AR / FA / PS) ──────────────────
 *
 * One engine behind DGT Connect, forms, reports, Print/PDF and any future module.
 * Resolution priority (highest first):
 *
 *   1. Local APPROVED translation memory      (human-verified, per phrase)
 *   2. Curated ERP glossary / dictionary      (business terminology)
 *   3. Local MACHINE translation memory       (previously produced, reusable)
 *   4. Local phrase / contextual engine       (dictionary substitution + translit)
 *   5. External MT (Google) — fallback only   (result is saved back to the TM)
 *
 * The ORIGINAL user text is never mutated. Translations are a *view*; callers
 * store `original` + `originalLang` and render the translated string separately.
 */

export const ERP_LANGS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];

export type TranslationEngine =
  | "approved" | "glossary" | "memory" | "local-phrase" | "machine" | "identity";

export type ErpTranslation = {
  text: string;
  lang: SupportedLanguage;
  engine: TranslationEngine;
  /** 0..1 — how much to trust this rendering */
  confidence: number;
};

// ── normalization ───────────────────────────────────────────────────────────
export function normalizeForMatch(input: string): string {
  return (input || "")
    .normalize("NFKC")
    .replace(/[ـ]/g, "")                 // Arabic tatweel
    .replace(/[ً-ٰٟۖ-ۭ]/g, "") // Arabic/Persian diacritics
    .replace(/[​-‏‪-‮]/g, "")       // zero-width / bidi marks
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isLang(v: unknown): v is SupportedLanguage {
  return typeof v === "string" && (ERP_LANGS as string[]).includes(v);
}

// ── glossary index (in-memory, built once) ──────────────────────────────────
let GLOSSARY_INDEX: Map<string, (typeof ERP_GLOSSARY)[number]> | null = null;
function glossaryIndex() {
  if (!GLOSSARY_INDEX) GLOSSARY_INDEX = buildGlossaryIndex(normalizeForMatch);
  return GLOSSARY_INDEX;
}

/** Exact glossary hit for a whole phrase. */
function glossaryExact(text: string, targetLang: SupportedLanguage): string | null {
  const e = glossaryIndex().get(normalizeForMatch(text));
  return e ? glossaryValue(e, targetLang) : null;
}

// Glossary terms sorted longest-first, for greedy multi-word substitution.
let GLOSSARY_TERMS_SORTED: Array<{ norm: string; entry: (typeof ERP_GLOSSARY)[number] }> | null = null;
function glossaryTermsSorted() {
  if (!GLOSSARY_TERMS_SORTED) {
    const seen = new Set<string>();
    const list: Array<{ norm: string; entry: (typeof ERP_GLOSSARY)[number] }> = [];
    for (const [k, entry] of glossaryIndex()) {
      if (!seen.has(k)) { seen.add(k); list.push({ norm: k, entry }); }
    }
    list.sort((a, b) => b.norm.length - a.norm.length);
    GLOSSARY_TERMS_SORTED = list;
  }
  return GLOSSARY_TERMS_SORTED;
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const LATIN_RE = /[a-z]/i;

/**
 * Contextual phrase substitution using the curated ERP glossary — replaces every
 * recognised business term/phrase (longest match first) with its target-language
 * rendering. Returns the rewritten string and a 0..1 coverage score (how much of
 * the meaningful source it could translate).
 */
function glossaryPhraseSubstitute(
  text: string,
  targetLang: SupportedLanguage,
): { result: string; coverage: number } {
  let work = text;
  const workLower = normalizeForMatch(text);
  let covered = 0;
  const totalLen = workLower.replace(/[^\p{L}\p{N}]/gu, "").length || 1;

  for (const { norm, entry } of glossaryTermsSorted()) {
    if (norm.length < 2) continue;
    if (!workLower.includes(norm)) continue;
    const target = glossaryValue(entry, targetLang);
    if (!target) continue;
    // word-boundary for latin terms; loose contains for RTL scripts
    const isLatin = LATIN_RE.test(norm);
    const re = new RegExp(isLatin ? `\\b${escapeRe(norm)}\\b` : escapeRe(norm), isLatin ? "gi" : "g");
    let matched = false;
    work = work.replace(re, () => { matched = true; return target; });
    if (matched) covered += norm.replace(/[^\p{L}\p{N}]/gu, "").length;
  }
  return { result: work, coverage: Math.min(1, covered / totalLen) };
}

// ── translation-memory row shape ────────────────────────────────────────────
type TmRow = {
  id: string; source_lang: string; source_norm: string; source_text: string;
  en: string | null; ur: string | null; ar: string | null; fa: string | null; ps: string | null;
  status: "approved" | "glossary" | "machine" | "draft"; engine: string; domain: string;
};

async function tmLookup(sourceLang: SupportedLanguage, norm: string): Promise<TmRow | null> {
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select id, source_lang, source_norm, source_text, en, ur, ar, fa, ps, status, engine, domain
      from public.erp_translation_memory
      where source_lang = ${sourceLang} and source_norm = ${norm}
      limit 1
    `) as unknown as TmRow[];
  });
  return rows?.[0] ?? null;
}

async function tmBump(id: string): Promise<void> {
  await withLocalPg(async (sql) => {
    await sql`update public.erp_translation_memory set hits = hits + 1 where id = ${id}::uuid`;
  });
}

async function tmUpsertMachine(
  sourceLang: SupportedLanguage, sourceText: string, values: Partial<Record<SupportedLanguage, string>>,
  engine: string, domain: GlossaryDomain,
): Promise<void> {
  const norm = normalizeForMatch(sourceText);
  if (!norm) return;
  await withLocalPg(async (sql) => {
    await sql`
      insert into public.erp_translation_memory
        (source_lang, source_norm, source_text, en, ur, ar, fa, ps, domain, status, engine)
      values (
        ${sourceLang}, ${norm}, ${sourceText},
        ${values.en ?? null}, ${values.ur ?? null}, ${values.ar ?? null}, ${values.fa ?? null}, ${values.ps ?? null},
        ${domain}, 'machine', ${engine}
      )
      on conflict (source_lang, source_norm) do update set
        en = coalesce(public.erp_translation_memory.en, excluded.en),
        ur = coalesce(public.erp_translation_memory.ur, excluded.ur),
        ar = coalesce(public.erp_translation_memory.ar, excluded.ar),
        fa = coalesce(public.erp_translation_memory.fa, excluded.fa),
        ps = coalesce(public.erp_translation_memory.ps, excluded.ps),
        updated_at = now()
      where public.erp_translation_memory.status <> 'approved'
    `;
  });
}

// ── the resolver ────────────────────────────────────────────────────────────
export type TranslateOpts = {
  targetLang: SupportedLanguage;
  domain?: GlossaryDomain;
  /** allow the external MT tier (Google). Default true. */
  allowExternal?: boolean;
  /** persist an external/local machine result back to the TM. Default true. */
  learn?: boolean;
};

export async function translateErp(
  text: string,
  sourceLang: SupportedLanguage,
  opts: TranslateOpts,
): Promise<ErpTranslation> {
  const targetLang = opts.targetLang;
  const src = (text ?? "").toString();
  const trimmed = src.trim();
  if (!trimmed || sourceLang === targetLang || !isLang(sourceLang) || !isLang(targetLang)) {
    return { text: src, lang: targetLang, engine: "identity", confidence: sourceLang === targetLang ? 1 : 0.2 };
  }

  const norm = normalizeForMatch(trimmed);

  // 1) + 3) translation memory (approved / glossary first, then machine)
  const tm = await tmLookup(sourceLang, norm);
  if (tm) {
    const v = (tm as any)[targetLang] as string | null;
    if (v && v.trim()) {
      void tmBump(tm.id);
      const engine: TranslationEngine =
        tm.status === "approved" ? "approved" : tm.status === "glossary" ? "glossary" : "memory";
      const confidence = tm.status === "approved" ? 1 : tm.status === "glossary" ? 0.97 : 0.8;
      return { text: v, lang: targetLang, engine, confidence };
    }
  }

  // 2) curated glossary (exact whole-phrase)
  const gx = glossaryExact(trimmed, targetLang);
  if (gx) return { text: gx, lang: targetLang, engine: "glossary", confidence: 0.97 };

  const residualLatin = (s: string) => (s.match(/\p{Lu}?[a-z]{2,}/giu) || []).length;

  // 3.5) contextual glossary phrase substitution on the raw source.
  const subRaw = glossaryPhraseSubstitute(trimmed, targetLang);
  if (subRaw.coverage >= 0.85 && residualLatin(subRaw.result) === 0) {
    return { text: subRaw.result, lang: targetLang, engine: "local-phrase", confidence: 0.8 };
  }

  // 4) local phrase engine (dictionary substitution + transliteration), then a
  // second glossary pass to fill any ERP term it left in English.
  let localText: string | null = null;
  let localResidual = Infinity;
  try {
    const five = autoTranslate5Languages(trimmed, sourceLang);
    let candidate = (five?.[targetLang]?.trim() || "");
    if (candidate) candidate = glossaryPhraseSubstitute(candidate, targetLang).result.trim();
    if (candidate && normalizeForMatch(candidate) !== norm) {
      localText = candidate;
      localResidual = residualLatin(candidate);
    }
  } catch { /* ignore */ }

  // prefer whichever local rendering has the least leftover English
  const subResidual = residualLatin(subRaw.result);
  if (subRaw.coverage >= 0.4 && normalizeForMatch(subRaw.result) !== norm && subResidual <= localResidual) {
    localText = subRaw.result;
    localResidual = subResidual;
  }

  const localIsClean = localText != null && localResidual === 0;

  // 5) external MT — only when the local engine left English behind or produced nothing
  if ((!localText || !localIsClean) && (opts.allowExternal ?? true)) {
    const mt = await translateViaMachineTranslation(trimmed, sourceLang, targetLang);
    if (mt && mt.trim() && normalizeForMatch(mt) !== norm) {
      if (opts.learn ?? true) {
        void tmUpsertMachine(sourceLang, trimmed, { [sourceLang]: trimmed, [targetLang]: mt.trim() } as any, "google", opts.domain ?? "general");
      }
      return { text: mt.trim(), lang: targetLang, engine: "machine", confidence: 0.7 };
    }
  }

  if (localText) {
    // only learn a clean rendering (no residual English) — never cache a transliteration
    if ((opts.learn ?? true) && localIsClean) {
      void tmUpsertMachine(sourceLang, trimmed, { [sourceLang]: trimmed, [targetLang]: localText } as any, "local", opts.domain ?? "general");
    }
    return { text: localText, lang: targetLang, engine: "local-phrase", confidence: localIsClean ? 0.6 : 0.4 };
  }

  // give back the original untranslated — never fabricate
  return { text: src, lang: targetLang, engine: "identity", confidence: 0.1 };
}

/** Translate into all five languages at once (used by record/report pipelines). */
export async function translateErpAll(
  text: string,
  sourceLang: SupportedLanguage,
  opts?: Omit<TranslateOpts, "targetLang">,
): Promise<Record<SupportedLanguage, string>> {
  const out = {} as Record<SupportedLanguage, string>;
  for (const lang of ERP_LANGS) {
    if (lang === sourceLang) { out[lang] = text; continue; }
    out[lang] = (await translateErp(text, sourceLang, { ...opts, targetLang: lang })).text;
  }
  return out;
}

// ── learning / approval ─────────────────────────────────────────────────────

/** Save a human-approved rendering; future lookups serve it locally forever. */
export async function approveErpTranslation(params: {
  sourceLang: SupportedLanguage;
  sourceText: string;
  values: Partial<Record<SupportedLanguage, string>>;
  domain?: GlossaryDomain;
  userId?: string | null;
}): Promise<{ id: string }> {
  const norm = normalizeForMatch(params.sourceText);
  const id = await withLocalPg(async (sql) => {
    const rows = (await sql`
      insert into public.erp_translation_memory
        (source_lang, source_norm, source_text, en, ur, ar, fa, ps, domain, status, engine, approved_by, approved_at, created_by)
      values (
        ${params.sourceLang}, ${norm}, ${params.sourceText},
        ${params.values.en ?? null}, ${params.values.ur ?? null}, ${params.values.ar ?? null}, ${params.values.fa ?? null}, ${params.values.ps ?? null},
        ${params.domain ?? "general"}, 'approved', 'human', ${params.userId ?? null}, now(), ${params.userId ?? null}
      )
      on conflict (source_lang, source_norm) do update set
        en = coalesce(excluded.en, public.erp_translation_memory.en),
        ur = coalesce(excluded.ur, public.erp_translation_memory.ur),
        ar = coalesce(excluded.ar, public.erp_translation_memory.ar),
        fa = coalesce(excluded.fa, public.erp_translation_memory.fa),
        ps = coalesce(excluded.ps, public.erp_translation_memory.ps),
        status = 'approved', engine = 'human',
        approved_by = ${params.userId ?? null}, approved_at = now(), updated_at = now()
      returning id
    `) as unknown as { id: string }[];
    await sql`
      insert into public.erp_translation_memory_audit (entry_id, actor_id, action, after)
      values (${rows[0].id}::uuid, ${params.userId ?? null}, 'approve', ${JSON.stringify(params.values)}::jsonb)
    `;
    return rows[0].id;
  });
  if (!id) throw new Error("Database unavailable");
  return { id };
}

export type TmStats = {
  total: number;
  approved: number;
  glossary: number;
  machine: number;
  draft: number;
  byDomain: Record<string, number>;
};

export async function erpTranslationStats(): Promise<TmStats> {
  const res = await withLocalPg(async (sql) => {
    const s = (await sql`select status, count(*)::int n from public.erp_translation_memory group by status`) as unknown as { status: string; n: number }[];
    const d = (await sql`select domain, count(*)::int n from public.erp_translation_memory group by domain`) as unknown as { domain: string; n: number }[];
    return { s, d };
  });
  const s = res?.s ?? [];
  const d = res?.d ?? [];
  const by = (k: string) => s.find((x) => x.status === k)?.n ?? 0;
  return {
    total: s.reduce((a, x) => a + x.n, 0),
    approved: by("approved"), glossary: by("glossary"), machine: by("machine"), draft: by("draft"),
    byDomain: Object.fromEntries(d.map((x) => [x.domain, x.n])),
  };
}
