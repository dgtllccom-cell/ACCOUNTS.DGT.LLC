import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { bankUpdateSchema } from "@/lib/api/erp-validation";
import { banksService } from "@/lib/services/banks-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireErpSession();
    const bank = await banksService.getById(params.id);
    return apiOk({ bank });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireErpSession();
    const body = bankUpdateSchema.parse(await request.json());

    await banksService.update(params.id, body, session.userId);

    await auditApiAction(request, {
      action: "banks.update.api",
      entityTable: "banks",
      entityId: params.id,
      after: body
    });

    return apiOk({ bankId: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireErpSession();
    await banksService.softDelete(params.id);

    await auditApiAction(request, {
      action: "banks.delete.api",
      entityTable: "banks",
      entityId: params.id
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
