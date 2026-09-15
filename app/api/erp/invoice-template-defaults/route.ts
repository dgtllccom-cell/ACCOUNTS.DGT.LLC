import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { canAccessCountryBranch, canAccessCityBranch } from "@/lib/permissions/middleware";
import {
  resolveInvoiceTemplateDefaultServer,
  saveInvoiceTemplateDefaultServer,
} from "@/lib/invoice-templates/resolve-default.server";

export const dynamic = "force-dynamic";

/**
 * Invoice & Print Templates — default-template resolution.
 *   GET  ?documentType=&companyId=&countryId=&countryBranchId=&cityBranchId=
 *        -> the highest-priority matching default (see resolve-default.server.ts)
 *   POST -> set/replace a default at a given scope (scope-gated: a caller may
 *           only write a scope they can see; global requires Super Admin)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const p = request.nextUrl.searchParams;
    const countryId = p.get("countryId") || null;
    if (!session.isSuperAdmin && countryId && session.countryIds?.length && !session.countryIds.includes(countryId)) {
      return apiError("FORBIDDEN", "Not authorized for this country's template defaults", 403);
    }
    const resolved = await resolveInvoiceTemplateDefaultServer({
      documentType: p.get("documentType") || null,
      companyId: p.get("companyId") || null,
      countryId,
      countryBranchId: p.get("countryBranchId") || null,
      cityBranchId: p.get("cityBranchId") || null,
    });
    return apiOk({ default: resolved });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    return apiError("SERVER_ERROR", (error as Error).message, 500);
  }
}

const saveSchema = z.object({
  scopeType: z.enum(["global", "company", "country", "country_branch", "city_branch"]),
  scopeId: z.string().uuid().optional().nullable(),
  documentType: z.enum(["commercial_invoice", "export_invoice", "packing_list", "proforma_invoice", "contract"]).optional().nullable(),
  templateId: z.enum(["classic", "modern", "professional", "compact", "premium"]),
  showLogo: z.boolean().optional(),
  showBankDetails: z.boolean().optional(),
  showTerms: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = saveSchema.parse(await request.json());

    if (body.scopeType === "global" || body.scopeType === "company") {
      if (!session.isSuperAdmin) return apiError("FORBIDDEN", "Only a Super Admin may set a global or company-wide default template", 403);
    } else if (body.scopeType === "country") {
      if (!session.isSuperAdmin && !(session.countryIds || []).includes(body.scopeId || "")) {
        return apiError("FORBIDDEN", "Not authorized for this country", 403);
      }
    } else if (body.scopeType === "country_branch") {
      if (!canAccessCountryBranch(session, body.scopeId || null)) {
        return apiError("FORBIDDEN", "Not authorized for this branch", 403);
      }
    } else {
      // city_branch
      if (!canAccessCityBranch(session, body.scopeId || null)) {
        return apiError("FORBIDDEN", "Not authorized for this city branch", 403);
      }
    }

    const { id } = await saveInvoiceTemplateDefaultServer({
      scopeType: body.scopeType,
      scopeId: body.scopeType === "global" ? null : (body.scopeId || null),
      documentType: body.documentType ?? null,
      templateId: body.templateId,
      showLogo: body.showLogo ?? true,
      showBankDetails: body.showBankDetails ?? true,
      showTerms: body.showTerms ?? true,
      createdBy: session.userId,
    });
    return apiOk({ id });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    if (error instanceof z.ZodError) return apiError("VALIDATION_ERROR", error.issues.map((i) => i.message).join("; ") || "Invalid request", 400);
    return apiError("SERVER_ERROR", (error as Error).message, 500);
  }
}
