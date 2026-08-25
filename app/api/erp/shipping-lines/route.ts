import { NextRequest } from "next/server";
import { apiCreated, apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { shippingLinesRepository } from "@/lib/repositories/shipping-lines-repository";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

export async function GET(request: NextRequest) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback, matching companies/route.ts's convention.
    }

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

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
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // allow fallback userId if unauthenticated demo
    }

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
      originalLanguage: body.originalLanguage || "en"
    });

    await translateMasterRecord(
      "shipping_lines",
      shippingLineId,
      { name: body.name },
      body.originalLanguage || "en",
      session?.userId ?? null
    );

    return apiCreated({ shippingLineId });
  } catch (error) {
    return handleApiError(error);
  }
}
