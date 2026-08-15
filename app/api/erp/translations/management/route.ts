import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { invalidateSystemDictionaryCache } from "@/lib/i18n/localize-records";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertRecordTranslationRpc } from "@/lib/services/enterprise-multilingual-service";
import { withLocalPg } from "@/lib/db/local-postgres";
import { z } from "zod";
import { auditApiAction } from "@/lib/api/audit";

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

    // Prefer direct-Postgres (works without a privileged Supabase key); fall back to admin.
    const term = q ? q.replace(/[%_]/g, "") : "";
    const viaPgRows = await withLocalPg(async (sql) => {
      const like = `%${term}%`;
      const rows = await sql`
        select * from record_translations
        where deleted_at is null
          ${moduleFilter ? sql`and record_table = ${moduleFilter}` : sql``}
          ${term ? sql`and (original_text ilike ${like} or field_name ilike ${like} or english_text ilike ${like}
            or urdu_text ilike ${like} or pashto_text ilike ${like} or persian_text ilike ${like} or arabic_text ilike ${like})` : sql``}
        order by updated_at desc
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
