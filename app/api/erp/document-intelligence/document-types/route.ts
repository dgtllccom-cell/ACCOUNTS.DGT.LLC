import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await guardIntake("read");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const rows = await documentIntakeService.listDocTypes(countryId);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
