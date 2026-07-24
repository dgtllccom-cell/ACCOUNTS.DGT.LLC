import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { auditApiAction } from "@/lib/api/audit";

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

    const admin = createSupabaseAdminClient() as any;

    let queryBuilder = admin
      .from("record_translations")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (moduleFilter) {
      queryBuilder = queryBuilder.eq("record_table", moduleFilter);
    }

    if (q) {
      const term = q.replace(/[%_]/g, "");
      queryBuilder = queryBuilder.or(
        `original_text.ilike.%${term}%,record_id.ilike.%${term}%,field_name.ilike.%${term}%,english_text.ilike.%${term}%,urdu_text.ilike.%${term}%,pashto_text.ilike.%${term}%,persian_text.ilike.%${term}%,arabic_text.ilike.%${term}%`
      );
    }

    const { data: rows, error } = await queryBuilder.limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    let records = rows ?? [];

    if (missingOnly) {
      records = records.filter((r: any) => {
        return (
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
    const admin = createSupabaseAdminClient() as any;

    const payload = {
      record_table: body.recordTable,
      record_id: body.recordId,
      field_name: body.fieldName,
      original_text: body.originalText,
      original_language_code: body.originalLanguageCode,
      english_text: body.englishText || body.originalText,
      urdu_text: body.urduText || "",
      pashto_text: body.pashtoText || "",
      persian_text: body.persianText || "",
      arabic_text: body.arabicText || "",
      language_texts: {
        en: body.englishText || body.originalText,
        ur: body.urduText || "",
        ps: body.pashtoText || "",
        fa: body.persianText || "",
        ar: body.arabicText || ""
      },
      translation_status: "complete",
      translated_by_engine: "local_dictionary",
      translated_at: new Date().toISOString(),
      source: "manual",
      corrected_by: session.userId,
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let resultData;
    if (body.id) {
      const { data, error } = await admin
        .from("record_translations")
        .update(payload)
        .eq("id", body.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      resultData = data;
    } else {
      const { data, error } = await admin
        .from("record_translations")
        .upsert(payload, { onConflict: "record_table,record_id,field_name" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      resultData = data;
    }

    await auditApiAction(request, {
      action: body.id ? "translation.update.manual" : "translation.create.manual",
      entityTable: "record_translations",
      entityId: resultData.id,
      after: payload
    });

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
    const admin = createSupabaseAdminClient() as any;

    let successCount = 0;

    for (const item of items) {
      const payload = {
        record_table: item.recordTable,
        record_id: item.recordId,
        field_name: item.fieldName,
        original_text: item.originalText,
        original_language_code: item.originalLanguageCode,
        english_text: item.englishText || item.originalText,
        urdu_text: item.urduText || "",
        pashto_text: item.pashtoText || "",
        persian_text: item.persianText || "",
        arabic_text: item.arabicText || "",
        language_texts: {
          en: item.englishText || item.originalText,
          ur: item.urduText || "",
          ps: item.pashtoText || "",
          fa: item.persianText || "",
          ar: item.arabicText || ""
        },
        translation_status: "complete",
        translated_by_engine: "local_dictionary",
        translated_at: new Date().toISOString(),
        source: "imported",
        corrected_by: session.userId,
        corrected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await admin
        .from("record_translations")
        .upsert(payload, { onConflict: "record_table,record_id,field_name" });

      if (!error) successCount++;
    }

    return apiOk({
      imported: successCount,
      total: items.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
