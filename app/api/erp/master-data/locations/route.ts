import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getErpSessionForApi } from "@/lib/auth/session";
import { masterParametersService, type MasterParameterCategory } from "@/lib/services/master-parameters-service";

/**
 * GET /api/erp/master-data/locations
 * Fetches standardized location & port Master Parameters by Country & Category.
 * Used across the entire ERP as the single source of truth.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as MasterParameterCategory | null;
    const countryId = searchParams.get("countryId");
    const countryName = searchParams.get("countryName");
    const countryIso2 = searchParams.get("countryIso2");
    const q = searchParams.get("q");

    const records = await masterParametersService.getParameters({
      category: category || undefined,
      countryId: countryId || undefined,
      countryName: countryName || undefined,
      countryIso2: countryIso2 || undefined,
      searchQuery: q || undefined
    });

    return apiOk({
      locations: records,
      total: records.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}
