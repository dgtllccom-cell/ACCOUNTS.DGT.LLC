import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/api/erp-validation";
import { shippingLinesRepository } from "@/lib/repositories/shipping-lines-repository";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

async function localizeShippingLine(shippingLine: any, lang: ReturnType<typeof normalizeLanguage>) {
  if (!shippingLine) return shippingLine;
  const [resolved] = await localizeRecordNames([shippingLine], "shipping_lines", "name", lang);
  return resolved;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback
    }

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    let shippingLine = await shippingLinesRepository.getById(id);
    shippingLine = await localizeShippingLine(shippingLine, lang);
    return apiOk({ shippingLine });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const body = await request.json();
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    await shippingLinesRepository.update(id, body);
    let shippingLine = await shippingLinesRepository.getById(id);
    shippingLine = await localizeShippingLine(shippingLine, lang);
    return apiOk({ shippingLine });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    await shippingLinesRepository.softDelete(id);
    return apiOk({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
