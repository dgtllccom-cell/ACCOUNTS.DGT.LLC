import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { invalidateSystemDictionaryCache, isApprovedStoredTranslation, isLegalName, trustedStoredTranslation } from "@/lib/i18n/localize-records";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertRecordTranslationRpc, saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { validateManualTranslationInput } from "@/lib/i18n/verified-record-translations";
import { suggestLatinName } from "@/lib/i18n/transliteration";
import { vocabularyFor } from "@/lib/i18n/table-values";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { withLocalPg } from "@/lib/db/local-postgres";
import { z } from "zod";
import { auditApiAction } from "@/lib/api/audit";

// ── Review queue (issue #36) ────────────────────────────────────────────────────────────────────────────────────────────
// Saved business text that has NO approved translation in a language yet — the place where a person approves the English
// (or Urdu / Arabic / Persian / Pashto) version of a name or a text typed in another language. Machine renderings are offered as
// SUGGESTIONS only; saving stores exactly the languages the reviewer entered (source "manual"), every other language keeps the
// saved text, and the original is never changed.
const REVIEW_LANGS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];
const LANG_COLUMN: Record<SupportedLanguage, string> = { en: "english_text", ur: "urdu_text", ar: "arabic_text", fa: "persian_text", ps: "pashto_text" };
const PERSO_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const PASHTO_LETTERS = /[ټډړښږځڅګڼۍې]/;
const URDU_LETTERS = /[ٹڈڑںےھہ]/;
const SAFE_TABLE = /^[a-z_][a-z0-9_]*$/;
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/** The language a saved text was typed in. The DB enrolment trigger records every value as 'en', so the script decides. */
function savedTextLanguage(text: string, stored: string | null | undefined): SupportedLanguage {
  // letters decide, not digits: "Bilal Traders ۱۲" is English
  if (!PERSO_ARABIC.test(text.replace(EASTERN_DIGITS, ""))) return "en";
  if (PASHTO_LETTERS.test(text)) return "ps";
  if (URDU_LETTERS.test(text)) return "ur";
  if (stored === "ar" || stored === "fa" || stored === "ps") return stored;
  return "ur";
}

/** Text worth a translation: has letters, and is not a code / number / reference. */
function isReviewableText(text: string): boolean {
  const v = text.trim();
  if (!/\p{L}/u.test(v)) return false;
  if (/^[\[{]/.test(v)) return false; // JSON blobs stored in a text column
  const compact = v.replace(/\s/g, "");
  const digits = (compact.match(/\d/g) || []).length;
  if (digits > 0 && digits / compact.length >= 0.3) return false;
  if (!PERSO_ARABIC.test(v) && /^[A-Z0-9][A-Z0-9._/-]*$/.test(compact) && /[-_/]/.test(compact)) return false;
  return true;
}

/** Ids of rows that still exist (not soft-deleted) in a base table; null when the table cannot be checked. */
async function liveRecordIds(sql: any, table: string, ids: string[]): Promise<Set<string> | null> {
  if (!SAFE_TABLE.test(table) || ids.length === 0) return null;
  const cols = await sql`select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and column_name in ('id', 'deleted_at')`;
  const names = new Set((cols as any[]).map((c) => c.column_name));
  if (!names.has("id")) return null;
  const rows = await sql.unsafe(
    `select id::text as id from public."${table}" where id::text = any($1::text[]) ${names.has("deleted_at") ? "and deleted_at is null" : ""}`,
    [ids]
  );
  return new Set((rows as any[]).map((r) => r.id));
}

function suggestionFor(table: string, field: string, original: string, row: any, lang: SupportedLanguage): string {
  const stored = String(row[LANG_COLUMN[lang]] ?? "").trim();
  const cleanStored = stored && stored !== original && (lang === "en" ? !PERSO_ARABIC.test(stored) : !/\p{Lu}?[a-z]{2,}/u.test(stored)) ? stored : "";
  const term = vocabularyFor(lang, original) ?? "";
  if (term) return term;
  if (lang === "en" && PERSO_ARABIC.test(original) && isLegalName(table, field)) return suggestLatinName(original);
  return cleanStored;
}

// record_translations is a VIEW over 5 per-language tables (INSTEAD OF triggers). ON CONFLICT
// is unsupported on such views, so all writes MUST go through the upsert_record_translation
// RPC (it runs the correct ON CONFLICT ... WHERE deleted_at IS NULL on the base tables).
// Central-dictionary rows are keyed by a deterministic UUIDv5 with field_name='term' — the
// SAME scheme scripts/seed-system-dictionary.mjs uses — so editing a seeded term updates that
// exact row instead of creating a slug/'name' duplicate.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID5_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function uuid5(name: string): string {
  const nb = Buffer.from(UUID5_NS.replace(/-/g, ""), "hex");
  const h = crypto.createHash("sha1").update(Buffer.concat([nb, Buffer.from(name)])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
/** Normalize the natural key. Dictionary terms get a stable UUIDv5 + field_name='term'. */
function normalizeTranslationKey(input: {
  recordTable: string; recordId: string; fieldName: string; englishText?: string | null; originalText: string;
}): { recordId: string; fieldName: string } {
  if (input.recordTable === "system_dictionary") {
    const term = String(input.englishText || input.originalText || input.recordId).trim().toLowerCase();
    return { recordId: uuid5(`system_dictionary:${term}`), fieldName: "term" };
  }
  // Non-dictionary corrections already carry the real record UUID + field.
  return { recordId: input.recordId, fieldName: input.fieldName };
}
async function saveTranslation(args: {
  recordTable: string; recordId: string; fieldName: string; originalText: string; originalLanguageCode: string;
  english: string | null; urdu: string | null; pashto: string | null; persian: string | null; arabic: string | null;
  source: string; status: string; engine: string; actorId: string | null;
}) {
  // Shared write path: direct-Postgres (DATABASE_URL) first, Supabase admin RPC fallback.
  await upsertRecordTranslationRpc({
    recordTable: args.recordTable,
    recordId: args.recordId,
    fieldName: args.fieldName,
    originalText: args.originalText,
    originalLanguageCode: args.originalLanguageCode,
    english: args.english,
    urdu: args.urdu,
    arabic: args.arabic,
    persian: args.persian,
    pashto: args.pashto,
    languageTexts: { en: args.english, ur: args.urdu, ps: args.pashto, fa: args.persian, ar: args.arabic },
    source: args.source,
    status: args.status,
    engine: args.engine,
    actorId: args.actorId
  });
}

/** Read a single translation row back — direct-Postgres first, Supabase admin fallback. */
async function selectTranslationRow(recordTable: string, recordId: string, fieldName: string) {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql`select * from record_translations
      where record_table = ${recordTable} and record_id = ${recordId}::uuid and field_name = ${fieldName} and deleted_at is null limit 1`;
    return (rows[0] ?? null) as any;
  });
  if (viaPg !== null) return viaPg;
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data } = await admin.from("record_translations").select("*")
      .eq("record_table", recordTable).eq("record_id", recordId).eq("field_name", fieldName).is("deleted_at", null).maybeSingle();
    return data ?? null;
  } catch { return null; }
}

const translationSaveSchema = z.object({
  id: z.string().uuid().optional(),
  recordTable: z.string().min(1).default("system_dictionary"),
  recordId: z.string().min(1),
  fieldName: z.string().min(1).default("name"),
  originalText: z.string().min(1),
  originalLanguageCode: z.string().default("en"),
  englishText: z.string().nullable().optional(),
  urduText: z.string().nullable().optional(),
  pashtoText: z.string().nullable().optional(),
  persianText: z.string().nullable().optional(),
  arabicText: z.string().nullable().optional(),
  moduleName: z.string().nullable().optional()
});

const translationBatchImportSchema = z.array(translationSaveSchema);

const reviewSaveSchema = z.object({
  review: z.literal(true),
  recordTable: z.string().regex(SAFE_TABLE),
  recordId: z.string().uuid(),
  fieldName: z.string().min(1).max(160),
  translations: z.object({
    en: z.string().trim().max(2000).optional(),
    ur: z.string().trim().max(2000).optional(),
    ar: z.string().trim().max(2000).optional(),
    fa: z.string().trim().max(2000).optional(),
    ps: z.string().trim().max(2000).optional()
  })
});

/**
 * Approve the translations a reviewer typed / accepted for ONE saved value. The original text and its language come from the
 * stored row (never from the request); only the languages the reviewer filled are stored as the person's entry. An account
 * name is approved for its ledger too (and a ledger's for its account) — both carry the same name.
 */
async function saveReviewedTranslation(review: z.infer<typeof reviewSaveSchema>, actorId: string | null) {
  const row = await selectTranslationRow(review.recordTable, review.recordId, review.fieldName);
  if (!row) throw new Error("This value is not enrolled for translation.");
  const originalText = String(row.original_text || "").trim();
  const originalLanguage = savedTextLanguage(originalText, row.original_language_code);
  const translations: Partial<Record<SupportedLanguage, string>> = {};
  for (const lang of REVIEW_LANGS) {
    const value = (review.translations as Record<string, string | undefined>)[lang]?.trim();
    if (value && lang !== originalLanguage && value !== originalText) translations[lang] = value;
  }
  if (Object.keys(translations).length === 0) throw new Error("Enter at least one translation that differs from the saved text.");
  // languages a person already approved for this value stay approved when another language is added
  if (isApprovedStoredTranslation(row)) {
    for (const lang of REVIEW_LANGS) {
      if (translations[lang] || lang === originalLanguage) continue;
      const kept = trustedStoredTranslation(review.recordTable, review.fieldName, originalText, row, lang);
      if (kept) translations[lang] = kept;
    }
  }
  const invalid = validateManualTranslationInput({ fieldName: review.fieldName, originalText, originalLanguage, translations });
  if (invalid) throw new Error(invalid);

  const save = (recordTable: string, recordId: string) => saveVerifiedEnterpriseRecordTranslations({
    recordTable,
    recordId,
    originalLanguage,
    actorId,
    source: "manual",
    fields: [{ fieldName: review.fieldName, value: originalText, translations }]
  });
  await save(review.recordTable, review.recordId);

  // the same name on the paired account / ledger rows (only when they still carry exactly this saved text)
  const paired = await withLocalPg(async (sql) => {
    if (review.recordTable === "enterprise_accounts") {
      return (await sql`select id::text as id, 'ledgers' as t from public.ledgers
        where enterprise_account_id = ${review.recordId}::uuid and deleted_at is null and btrim(name) = ${originalText}`) as any[];
    }
    if (review.recordTable === "ledgers") {
      return (await sql`select ea.id::text as id, 'enterprise_accounts' as t from public.ledgers l
        join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
        where l.id = ${review.recordId}::uuid and ea.deleted_at is null and btrim(ea.name) = ${originalText}
        union all
        select l2.id::text, 'ledgers' from public.ledgers l
        join public.ledgers l2 on l2.enterprise_account_id = l.enterprise_account_id and l2.id <> l.id
        where l.id = ${review.recordId}::uuid and l2.deleted_at is null and btrim(l2.name) = ${originalText}`) as any[];
    }
    return [] as any[];
  });
  for (const p of paired ?? []) await save(p.t, p.id);

  return { recordTable: review.recordTable, recordId: review.recordId, fieldName: review.fieldName, originalLanguage, translations, pairedRecords: (paired ?? []).length };
}

/**
 * GET /api/erp/translations/management
 * Fetches all local translations for Super Admin management.
 * Supports searching by query term (`q`), filtering by module (`module`),
 * and filtering for missing translations (`missingOnly=true`).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiError("FORBIDDEN", "Only Super Admin can access local translation management", 403);
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const moduleFilter = searchParams.get("module")?.trim() ?? "";
    const missingOnly = searchParams.get("missingOnly") === "true";
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    if (searchParams.get("review") === "true") {
      const needLangParam = (searchParams.get("needLang") || "en") as SupportedLanguage;
      const needLang = (REVIEW_LANGS as string[]).includes(needLangParam) ? needLangParam : "en";
      const term = q ? q.replace(/[%_]/g, "") : "";
      const queue = await withLocalPg(async (sql) => {
        const like = `%${term}%`;
        const rows = (await sql`
          select rt.id, rt.record_table, rt.record_id::text as record_id, rt.field_name, rt.original_text, rt.original_language_code,
                 rt.english_text, rt.urdu_text, rt.arabic_text, rt.persian_text, rt.pashto_text,
                 rt.translation_status, rt.translated_by_engine, rt.source::text as source, rt.corrected_by, rt.updated_at
          from record_translations rt
          where rt.deleted_at is null and rt.record_table <> 'system_dictionary' and coalesce(rt.original_text, '') <> ''
            ${moduleFilter ? sql`and rt.record_table = ${moduleFilter}` : sql``}
            ${term ? sql`and (rt.original_text ilike ${like} or rt.english_text ilike ${like} or rt.urdu_text ilike ${like}
              or rt.pashto_text ilike ${like} or rt.persian_text ilike ${like} or rt.arabic_text ilike ${like})` : sql``}
          order by rt.updated_at desc
          limit 3000`) as any[];
        // only rows still lacking an approved translation in the requested language
        const pending = rows.filter((r) => {
          const original = String(r.original_text || "").trim();
          if (!isReviewableText(original)) return false;
          if (savedTextLanguage(original, r.original_language_code) === needLang) return false;
          return !trustedStoredTranslation(r.record_table, r.field_name, original, isApprovedStoredTranslation(r) ? r : null, needLang);
        });
        // never queue text of records that were deleted
        const byTable = new Map<string, string[]>();
        for (const r of pending) byTable.set(r.record_table, [...(byTable.get(r.record_table) ?? []), r.record_id]);
        const live = new Map<string, Set<string> | null>();
        for (const [table, ids] of byTable) live.set(table, await liveRecordIds(sql, table, ids).catch(() => null));
        return pending.filter((r) => {
          const ids = live.get(r.record_table);
          return ids === null || ids === undefined ? true : ids.has(r.record_id);
        });
      });
      const items = (queue ?? []).slice(0, limit).map((r: any) => {
        const original = String(r.original_text || "").trim();
        const approvedRow = isApprovedStoredTranslation(r);
        const approved: Partial<Record<SupportedLanguage, string>> = {};
        const suggestions: Partial<Record<SupportedLanguage, string>> = {};
        for (const lang of REVIEW_LANGS) {
          const value = approvedRow ? trustedStoredTranslation(r.record_table, r.field_name, original, r, lang) : null;
          if (value) approved[lang] = value;
          else {
            const suggestion = suggestionFor(r.record_table, r.field_name, original, r, lang);
            if (suggestion && suggestion !== original) suggestions[lang] = suggestion;
          }
        }
        return {
          id: r.id,
          recordTable: r.record_table,
          recordId: r.record_id,
          fieldName: r.field_name,
          originalText: original,
          originalLanguageCode: savedTextLanguage(original, r.original_language_code),
          kind: isLegalName(r.record_table, r.field_name) ? "name" : "text",
          status: r.translation_status || "pending",
          approved,
          suggestions,
          updatedAt: r.updated_at
        };
      });
      const modules = new Map<string, number>();
      for (const r of queue ?? []) modules.set(r.record_table, (modules.get(r.record_table) ?? 0) + 1);
      return apiOk({
        review: true,
        needLang,
        items,
        total: (queue ?? []).length,
        modules: [...modules.entries()].sort((a, b) => b[1] - a[1]).map(([table, count]) => ({ table, count }))
      });
    }

    // Prefer direct-Postgres (works without a privileged Supabase key); fall back to admin.
    const term = q ? q.replace(/[%_]/g, "") : "";
    const viaPgRows = await withLocalPg(async (sql) => {
      const like = `%${term}%`;
      const rows = await sql`
        select rt.* from record_translations rt
        where rt.deleted_at is null
          and not (rt.record_table = 'customers' and exists (select 1 from customers c where c.id = rt.record_id::uuid and c.deleted_at is not null))
          and not (rt.record_table = 'companies' and exists (select 1 from companies comp where comp.id = rt.record_id::uuid and comp.deleted_at is not null))
          and not (rt.record_table = 'employees' and exists (select 1 from employees emp where emp.id = rt.record_id::uuid and emp.deleted_at is not null))
          ${moduleFilter ? sql`and rt.record_table = ${moduleFilter}` : sql``}
          ${term ? sql`and (rt.original_text ilike ${like} or rt.field_name ilike ${like} or rt.english_text ilike ${like}
            or rt.urdu_text ilike ${like} or rt.pashto_text ilike ${like} or rt.persian_text ilike ${like} or rt.arabic_text ilike ${like})` : sql``}
        order by rt.updated_at desc
        limit ${limit}`;
      return rows as any[];
    });

    let queryBuilder: any = null;
    if (viaPgRows === null) {
      const admin = createSupabaseAdminClient() as any;
      queryBuilder = admin
        .from("record_translations")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (moduleFilter) {
        queryBuilder = queryBuilder.eq("record_table", moduleFilter);
      }

      if (q) {
        queryBuilder = queryBuilder.or(
          `original_text.ilike.%${term}%,record_id.ilike.%${term}%,field_name.ilike.%${term}%,english_text.ilike.%${term}%,urdu_text.ilike.%${term}%,pashto_text.ilike.%${term}%,persian_text.ilike.%${term}%,arabic_text.ilike.%${term}%`
        );
      }
    }

    let rows: any[];
    if (viaPgRows !== null) {
      rows = viaPgRows;
    } else {
      const { data, error } = await queryBuilder.limit(limit);
      if (error) throw new Error(error.message);
      rows = data ?? [];
    }

    let records = rows ?? [];

    if (missingOnly) {
      records = records.filter((r: any) => {
        const isFallback =
          Boolean(r.original_text) &&
          r.urdu_text === r.original_text &&
          r.arabic_text === r.original_text &&
          r.persian_text === r.original_text &&
          r.pashto_text === r.original_text;

        return (
          r.translation_status === "pending" ||
          r.translation_status === "needs_review" ||
          isFallback ||
          !r.english_text?.trim() ||
          !r.urdu_text?.trim() ||
          !r.pashto_text?.trim() ||
          !r.persian_text?.trim() ||
          !r.arabic_text?.trim()
        );
      });
    }

    // Map to normalized response objects
    const mapped = records.map((r: any) => ({
      id: r.id,
      translationKey: r.record_id || r.field_name,
      recordTable: r.record_table,
      recordId: r.record_id,
      fieldName: r.field_name,
      originalText: r.original_text,
      originalLanguageCode: r.original_language_code || "en",
      englishText: r.english_text || "",
      urduText: r.urdu_text || "",
      pashtoText: r.pashto_text || "",
      persianText: r.persian_text || "",
      arabicText: r.arabic_text || "",
      source: r.source || "manual",
      updatedAt: r.updated_at
    }));

    return apiOk({
      translations: mapped,
      total: mapped.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/translations/management
 * Creates or updates a translation key entry locally in the database.
 * No AI APIs are involved.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiError("FORBIDDEN", "Only Super Admin can edit local translations", 403);
    }

    const rawBody = await request.json();
    if (rawBody && rawBody.review === true) {
      const review = reviewSaveSchema.parse(rawBody);
      const saved = await saveReviewedTranslation(review, session.userId ?? null);
      try {
        await auditApiAction(request, {
          action: "translation.review.approve",
          entityTable: "record_translations",
          entityId: review.recordId,
          after: { recordTable: review.recordTable, recordId: review.recordId, fieldName: review.fieldName, languages: Object.keys(saved.translations) }
        });
      } catch { /* audit is best-effort; never block a translation save */ }
      return apiCreated({ reviewed: true, ...saved });
    }
    const body = translationSaveSchema.parse(rawBody);

    const { recordId, fieldName } = normalizeTranslationKey({
      recordTable: body.recordTable,
      recordId: body.recordId,
      fieldName: body.fieldName,
      englishText: body.englishText,
      originalText: body.originalText
    });
    const english = body.englishText || body.originalText;

    // Manual translator save is authoritative: store the values verbatim as approved.
    await saveTranslation({
      recordTable: body.recordTable,
      recordId,
      fieldName,
      originalText: body.originalText,
      originalLanguageCode: body.originalLanguageCode,
      english,
      urdu: body.urduText || null,
      pashto: body.pashtoText || null,
      persian: body.persianText || null,
      arabic: body.arabicText || null,
      source: "manual",
      status: "complete",
      engine: "local_dictionary",
      actorId: session.userId
    });

    const resultData = await selectTranslationRow(body.recordTable, recordId, fieldName);

    try {
      await auditApiAction(request, {
        action: body.id ? "translation.update.manual" : "translation.create.manual",
        entityTable: "record_translations",
        entityId: resultData?.id ?? recordId,
        after: { recordTable: body.recordTable, recordId, fieldName, english }
      });
    } catch { /* audit is best-effort; never block a translation save */ }

    // If a central dictionary term was saved/approved, refresh the ERP-wide dictionary cache now.
    if (body.recordTable === "system_dictionary") invalidateSystemDictionaryCache();

    return apiCreated({
      translation: resultData
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/erp/translations/management
 * Batch import translations (JSON array).
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin")) {
      return apiError("FORBIDDEN", "Only Super Admin can import local translations", 403);
    }

    const rawBody = await request.json();
    const items = translationBatchImportSchema.parse(rawBody);

    let successCount = 0;

    for (const item of items) {
      try {
        const { recordId, fieldName } = normalizeTranslationKey({
          recordTable: item.recordTable,
          recordId: item.recordId,
          fieldName: item.fieldName,
          englishText: item.englishText,
          originalText: item.originalText
        });
        await saveTranslation({
          recordTable: item.recordTable,
          recordId,
          fieldName,
          originalText: item.originalText,
          originalLanguageCode: item.originalLanguageCode,
          english: item.englishText || item.originalText,
          urdu: item.urduText || null,
          pashto: item.pashtoText || null,
          persian: item.persianText || null,
          arabic: item.arabicText || null,
          source: "imported",
          status: "complete",
          engine: "local_dictionary",
          actorId: session.userId
        });
        successCount++;
      } catch {
        // Skip the failed row; report the count so the importer sees partial success.
      }
    }

    // Imported terms may include central dictionary entries — refresh the ERP-wide cache.
    invalidateSystemDictionaryCache();

    return apiOk({
      imported: successCount,
      total: items.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
