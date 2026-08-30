import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/api/response";
import { getCurrentErpSession } from "@/lib/auth/session";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { approveErpTranslation } from "@/lib/i18n/erp-translator";

export const dynamic = "force-dynamic";

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;
const DOMAINS = ["accounting", "shipping", "clearing", "banking", "tax", "hr", "crm", "purchase", "sales", "inventory", "general"] as const;

const schema = z.object({
  sourceLang: z.enum(LANGS),
  sourceText: z.string().min(1).max(8000),
  values: z.object({
    en: z.string().max(8000).optional(),
    ur: z.string().max(8000).optional(),
    ar: z.string().max(8000).optional(),
    fa: z.string().max(8000).optional(),
    ps: z.string().max(8000).optional(),
  }),
  domain: z.enum(DOMAINS).optional(),
});

/** Promote a rendering to APPROVED — served locally & consistently from then on. */
export async function POST(request: NextRequest) {
  const session = await getCurrentErpSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication is required", 401);
  // super admin or anyone with translation-management permission
  const allowed = session.isSuperAdmin
    || hasRolePermission(session, "translations", "update")
    || hasRolePermission(session, "translation_field_registry", "update");
  if (!allowed) return apiError("FORBIDDEN", "Not permitted to approve translations", 403);

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());
    const { id } = await approveErpTranslation({
      sourceLang: parsed.data.sourceLang,
      sourceText: parsed.data.sourceText,
      values: parsed.data.values,
      domain: parsed.data.domain,
      userId: session.userId,
    });
    return apiOk({ id, status: "approved" });
  } catch (error) {
    console.error("[i18n/translate/approve]", error instanceof Error ? error.message : error);
    return apiError("APPROVE_ERROR", "Could not save the approved translation.", 503);
  }
}
