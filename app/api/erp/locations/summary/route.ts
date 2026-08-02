import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { locationsRepository } from "@/lib/repositories/locations-repository";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get("countryId");
    const stateId = searchParams.get("stateId");
    const includeTree = searchParams.get("tree") === "true";

    const stats = await locationsRepository.getLocationSummaryStats();

    if (includeTree) {
      const fullTree = await locationsRepository.getFullLocationTree();
      return apiOk({ stats, fullTree });
    }

    if (stateId) {
      const citySummaries = await locationsRepository.listCitySummaries(stateId);
      return apiOk({ stats, citySummaries });
    }

    if (countryId) {
      const stateSummaries = await locationsRepository.listStateSummaries(countryId);
      return apiOk({ stats, stateSummaries });
    }

    const countrySummaries = await locationsRepository.listCountrySummaries();
    return apiOk({ stats, countrySummaries });
  } catch (error) {
    return handleApiError(error);
  }
}
