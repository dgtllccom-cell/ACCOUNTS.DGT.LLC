import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback
    }

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
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // Allow fallback
    }

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const body = await request.json();

    await companiesService.update(id, body, session?.userId ?? null);
    const company = await companiesService.getById(id);
    return apiOk({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    await companiesService.softDelete(id);
    return apiOk({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
