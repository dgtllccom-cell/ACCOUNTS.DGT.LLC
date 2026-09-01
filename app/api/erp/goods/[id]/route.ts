import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { goodsUpdateSchema } from "@/lib/api/erp-validation";
import { goodsService } from "@/lib/services/goods-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    authorizeApiScope(session, {
      resource: "goods",
      action: "read"
    });

    const data: any = await goodsService.getById(id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    if (data?.goods) {
      const [resolved] = await localizeRecordNames([data.goods], "goods", "goods_name", lang);
      data.goods = resolved;
    }
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const body = goodsUpdateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "goods",
      action: "update"
    });

    await goodsService.update(
      id,
      {
        chsCode: body.chsCode,
        goodsName: body.goodsName,
        originCountryId: body.originCountryId,
        isActive: body.isActive,
        originalLanguage: body.originalLanguage,
        minStockLevel: body.minStockLevel,
        reorderLevel: body.reorderLevel,
        barcode: body.barcode,
        barcodeType: body.barcodeType
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "goods.update.api",
      entityTable: "goods",
      entityId: id,
      after: body
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    authorizeApiScope(session, {
      resource: "goods",
      action: "delete"
    });

    await goodsService.softDelete(id);

    await auditApiAction(request, {
      action: "goods.delete.api",
      entityTable: "goods",
      entityId: id
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
