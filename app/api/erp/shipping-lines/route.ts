import { NextRequest } from "next/server";
import { apiCreated, apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { shippingLinesRepository } from "@/lib/repositories/shipping-lines-repository";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const result = await shippingLinesRepository.search({
      query,
      limit: limit ? Number(limit) : 100
    });

    let shippingLines: any[] = (result as any).shippingLines ?? [];
    if (Array.isArray(shippingLines) && shippingLines.length > 0) {
      shippingLines = await localizeRecordNames<any>(shippingLines, "shipping_lines", "name", lang);
    }

    return apiOk({ ...(result as any), shippingLines });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Was fully anonymous ("allow fallback userId if unauthenticated demo") —
    // no permission string exists yet for this resource to gate on safely
    // without guessing which roles should be excluded, so the minimal,
    // non-breaking fix is requiring a real session, matching every other
    // creation endpoint in this codebase.
    const session = await requireErpSession();

    const body = await request.json();
    if (!body?.name || !String(body.name).trim()) {
      return apiError("VALIDATION_ERROR", "name is required", 400);
    }

    const shippingLineId = await shippingLinesRepository.create({
      name: body.name,
      contactPerson: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      countryId: body.countryId ?? null,
      remarks: body.remarks ?? null,
      linkedCountries: Array.isArray(body.linkedCountries) ? body.linkedCountries : [],
      originalLanguage: body.originalLanguage || "en"
    });

    await translateMasterRecord(
      "shipping_lines",
      shippingLineId,
      { name: body.name },
      body.originalLanguage || "en",
      session.userId
    );

    return apiCreated({ shippingLineId });
  } catch (error) {
    return handleApiError(error);
  }
}
