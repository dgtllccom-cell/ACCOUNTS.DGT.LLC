import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getErpSessionForApi } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

export async function GET(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get("countryId");
    const stateId = searchParams.get("stateId");
    const includeTree = searchParams.get("tree") === "true";

    if (includeTree) {
      const stats = await locationsRepository.getLocationSummaryStats();
      const fullTree = await locationsRepository.getFullLocationTree();
      return apiOk({ stats, fullTree });
    }

    if (stateId) {
      const stats = await locationsRepository.getLocationSummaryStats();
      const citySummaries = await locationsRepository.listCitySummaries(stateId);
      return apiOk({ stats, citySummaries });
    }

    if (countryId) {
      const stats = await locationsRepository.getLocationSummaryStats();
      const stateSummaries = await locationsRepository.listStateSummaries(countryId);
      return apiOk({ stats, stateSummaries });
    }

    // Default view — stats + per-country breakdown in one round-trip.
    const { stats, countrySummaries } = await locationsRepository.getLocationOverview();
    return apiOk({ stats, countrySummaries });
  } catch (error) {
    return handleApiError(error);
  }
}
