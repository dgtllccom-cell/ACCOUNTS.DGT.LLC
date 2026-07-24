import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uuidSchema } from "@/lib/api/erp-validation";
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

