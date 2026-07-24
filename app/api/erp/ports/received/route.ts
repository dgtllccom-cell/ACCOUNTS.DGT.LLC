import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { portCreateSchema } from "@/lib/api/erp-validation";
import { receivedPortsService } from "@/lib/services/ports-service";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();

    const query = request.nextUrl.searchParams.get("q");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const transportType = request.nextUrl.searchParams.get("type"); // sea, road, air
    const limit = request.nextUrl.searchParams.get("limit");
    const all = request.nextUrl.searchParams.get("all") === "true";

    const result = await receivedPortsService.search({
      query,
      countryId,
      transportType,
      limit: limit ? Number(limit) : 50,
      all
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = portCreateSchema.parse(await request.json());

    const portId = await receivedPortsService.create(
      {
        portName: body.portName,
        countryId: body.countryId,
        portCode: body.portCode,
        transportType: body.transportType,
        isActive: body.isActive
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "received_ports.create.api",
      entityTable: "received_ports",
      entityId: portId,
      after: body
    });

    return apiCreated({ portId });
  } catch (error) {
    return handleApiError(error);
  }
}
