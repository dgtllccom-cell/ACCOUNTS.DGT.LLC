import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { portCreateSchema } from "@/lib/api/erp-validation";
import { receivedPortsService } from "@/lib/services/ports-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();

    const query = request.nextUrl.searchParams.get("q");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const transportType = request.nextUrl.searchParams.get("type"); // sea, road, air
    const limit = request.nextUrl.searchParams.get("limit");
    const all = request.nextUrl.searchParams.get("all") === "true";

    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const result = await receivedPortsService.search({
      query,
      countryId,
      transportType,
      limit: limit ? Number(limit) : 50,
      all
    });

    try {
      result.ports = await localizeRecordFields<any>(result.ports, "ports", ["port_name"], lang);
    } catch {
      // keep original port names
    }

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
      session.userId,
      session.preferredLanguage ?? "en"
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
