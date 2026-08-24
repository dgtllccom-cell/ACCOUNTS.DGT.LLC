import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { party360Service } from "@/lib/services/party-360-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });

    const customerId = request.nextUrl.searchParams.get("customerId") || undefined;
    const name = request.nextUrl.searchParams.get("name") || undefined;
    const employeeId = request.nextUrl.searchParams.get("employeeId") || undefined;
    const lang = request.nextUrl.searchParams.get("lang") || "ur";

    const summary = await party360Service.getParty360Summary({
      customerId,
      name,
      employeeId,
      lang
    });

    return apiOk({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
