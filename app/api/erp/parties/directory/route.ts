import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { party360Service } from "@/lib/services/party-360-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });

    const query = request.nextUrl.searchParams.get("q") || request.nextUrl.searchParams.get("search") || "";
    const limit = Number(request.nextUrl.searchParams.get("limit") || "100");
    const offset = Number(request.nextUrl.searchParams.get("offset") || "0");

    const result = await party360Service.getUniversalPartiesDirectory({
      query,
      limit,
      offset
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
