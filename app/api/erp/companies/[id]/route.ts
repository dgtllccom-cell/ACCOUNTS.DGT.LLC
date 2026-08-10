import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { companyUpdateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "read" });

    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    const company = await companiesService.getById(id);
    return apiOk({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "update" });

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const body = companyUpdateSchema.parse(await request.json());

    await companiesService.update(id, body, session.userId);

    await auditApiAction(request, {
      action: "companies.update.api",
      entityTable: "companies",
      entityId: id,
      after: body
    });

    return apiOk({ companyId: id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "delete" });

    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    await companiesService.softDelete(id);

    await auditApiAction(request, {
      action: "companies.delete.api",
      entityTable: "companies",
      entityId: id
    });

    return apiOk({ companyId: id });
  } catch (error) {
    return handleApiError(error);
  }
}
