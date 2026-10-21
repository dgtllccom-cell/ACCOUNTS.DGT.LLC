import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { getErpSessionForApi } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { translateCountry } from "@/lib/i18n/table-values";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

export async function GET(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const searchParams = request.nextUrl.searchParams;
    const countryId = searchParams.get("countryId");
    const stateId = searchParams.get("stateId");
    const includeTree = searchParams.get("tree") === "true";
    const lang = await getRequestLanguage(searchParams.get("lang") || searchParams.get("language"));

    if (includeTree) {
      const stats = await locationsRepository.getLocationSummaryStats();
      let fullTree = await locationsRepository.getFullLocationTree();
      if (lang !== "en" && fullTree?.length) {
        fullTree = fullTree.map((c) => ({
          ...c,
          name: translateCountry(c.name, lang),
          children: (c.children || []).map((s) => ({
            ...s,
            name: transliterateProperNoun(s.name, lang),
            children: (s.children || []).map((d) => ({
              ...d,
              name: transliterateProperNoun(d.name, lang),
              children: (d.children || []).map((ct) => ({
                ...ct,
                name: transliterateProperNoun(ct.name, lang)
              }))
            }))
          }))
        }));
      }
      return apiOk({ stats, fullTree });
    }

    if (stateId) {
      const stats = await locationsRepository.getLocationSummaryStats();
      let citySummaries = await locationsRepository.listCitySummaries(stateId);
      if (citySummaries?.length) {
        citySummaries = await localizeRecordNames(citySummaries, "cities", "name", lang);
      }
      return apiOk({ stats, citySummaries });
    }

    if (countryId) {
      const stats = await locationsRepository.getLocationSummaryStats();
      let stateSummaries = await locationsRepository.listStateSummaries(countryId);
      if (stateSummaries?.length) {
        stateSummaries = await localizeRecordNames(stateSummaries, "states_provinces", "name", lang);
      }
      return apiOk({ stats, stateSummaries });
    }

    // Default view — stats + per-country breakdown in one round-trip.
    const { stats, countrySummaries } = await locationsRepository.getLocationOverview();
    let localizedCountrySummaries = countrySummaries;
    if (countrySummaries?.length) {
      localizedCountrySummaries = await localizeRecordNames(countrySummaries, "countries", "name", lang);
    }
    return apiOk({ stats, countrySummaries: localizedCountrySummaries });
  } catch (error) {
    return handleApiError(error);
  }
}

