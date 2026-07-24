import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { linkEmailAccount } from "@/lib/api/email-link";
import { ensureCountryLocationMasterData } from "@/lib/services/location-master-population-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const q = request.nextUrl.searchParams.get("q");
    let countries = await locationsRepository.listCountries({ query: q, limit: 500 });

    // Scope: super admin can see all; others see only assigned countries.
    // Pass ?all=true to bypass scoping (used for transit country pickers in purchase wizard).
    const bypassScope = request.nextUrl.searchParams.get("all") === "true";
    if (!session.isSuperAdmin && !bypassScope) {
      const allowed = new Set(session.countryIds);
      countries = countries.filter((c) => allowed.has(c.id));
    }
    return apiOk({ countries });
  } catch (error) {
    return handleApiError(error);
  }
}

function getCountryDetails(code: string) {
  const c = code.trim().toUpperCase();
  if (c === "PK" || c === "PAK") {
    return { iso2: "PK", iso3: "PAK", currency: "PKR", phoneCode: "+92", officialEmail: "official@dgt.pk", adminEmail: "admin@dgt.pk" };
  } else if (c === "IN" || c === "IND") {
    return { iso2: "IN", iso3: "IND", currency: "INR", phoneCode: "+91", officialEmail: "official@dgt.in", adminEmail: "admin@dgt.in" };
  } else if (c === "AE" || c === "ARE" || c === "UAE") {
    return { iso2: "AE", iso3: "ARE", currency: "AED", phoneCode: "+971", officialEmail: "official@dgt.ae", adminEmail: "admin@dgt.ae" };
  } else if (c === "IR" || c === "IRN") {
    return { iso2: "IR", iso3: "IRN", currency: "IRR", phoneCode: "+98", officialEmail: "official@dgt.ir", adminEmail: "admin@dgt.ir" };
  } else if (c === "AF" || c === "AFG") {
    return { iso2: "AF", iso3: "AFG", currency: "AFN", phoneCode: "+93", officialEmail: "official@dgt.af", adminEmail: "admin@dgt.af" };
  }
  return {
    iso2: c.slice(0, 2),
    iso3: c.length === 3 ? c : c.slice(0, 3) + "X",
    currency: "USD",
    phoneCode: null,
    officialEmail: `official@dgt.${c.toLowerCase()}`,
    adminEmail: `admin@dgt.${c.toLowerCase()}`
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      throw new Error("Only Super Admin can create countries.");
    }

    const body = (await request.json()) as {
      name: string;
      iso2: string;
      iso3?: string | null;
      currencyCode?: string | null;
      defaultLanguageCode?: string | null;
      officialEmail?: string | null;
      adminEmail?: string | null;
      whatsappNumber?: string | null;
    };

    if (!body.name?.trim() || !body.iso2?.trim()) {
      throw new Error("Country Name and Country Code (ISO2) are required");
    }

    const details = getCountryDetails(body.iso2);

    const country = await locationsRepository.createCountry({
      name: body.name,
      iso2: details.iso2,
      iso3: body.iso3 || details.iso3,
      currencyCode: body.currencyCode || details.currency,
      defaultLanguageCode: body.defaultLanguageCode || "en",
      phoneCode: details.phoneCode,
      officialEmail: body.officialEmail || details.officialEmail,
      adminEmail: body.adminEmail || details.adminEmail,
      whatsappNumber: body.whatsappNumber || null
    });

    await linkEmailAccount({
      countryId: country.id,
      scope: "country",
      displayName: `${country.name} Official`,
      emailAddress: country.official_email,
      adminEmail: country.admin_email
    });

    const masterPopulation = await ensureCountryLocationMasterData({
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3
    });

    return apiCreated({ country, masterPopulation });
  } catch (error) {
    return handleApiError(error);
  }
}
