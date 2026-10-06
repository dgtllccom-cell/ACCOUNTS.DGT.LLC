import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { supportedLanguageSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { saveEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";

const fieldSchema = z.object({
  fieldName: z.string().trim().min(1).max(120),
  value: z.string().max(10_000).nullable().optional()
});

const batchSchema = z.object({
  recordTable: z.string().trim().min(2).max(120),
  recordId: z.string().uuid(),
  originalLanguage: supportedLanguageSchema.default("en"),
  source: z.enum(["auto", "manual", "imported"]).default("auto"),
  fields: z.array(fieldSchema).min(1).max(80)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "settings", action: "update" });

    const body = batchSchema.parse(await request.json());
    const saved = await saveEnterpriseRecordTranslations({
      recordTable: body.recordTable,
      recordId: body.recordId,
      originalLanguage: body.originalLanguage,
      fields: body.fields.map((field) => ({ fieldName: field.fieldName, value: field.value ?? null })),
      actorId: session.userId,
      source: body.source
    });

    return apiCreated({
      recordTable: body.recordTable,
      recordId: body.recordId,
      languageCount: 5,
      fieldCount: body.fields.length,
      savedCount: saved.length,
      saved
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  return apiOk({
    endpoint: "/api/erp/translations/batch",
    method: "POST",
    supportedLanguages: ["en", "ur", "ps", "fa", "ar"],
    purpose: "Save all translated business-record fields into record_translations."
  });
}
