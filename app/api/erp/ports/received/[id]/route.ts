import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { portUpdateSchema } from "@/lib/api/erp-validation";
import { receivedPortsService } from "@/lib/services/ports-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await params;
    const port = await receivedPortsService.getById(id);
    return apiOk({ port });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = portUpdateSchema.parse(await request.json());

    await receivedPortsService.update(id, body, session.userId);

    await auditApiAction(request, {
      action: "received_ports.update.api",
      entityTable: "received_ports",
      entityId: id,
      after: body
    });

    return apiOk({ portId: id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await params;
    await receivedPortsService.softDelete(id);

    await auditApiAction(request, {
      action: "received_ports.delete.api",
      entityTable: "received_ports",
      entityId: id
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
