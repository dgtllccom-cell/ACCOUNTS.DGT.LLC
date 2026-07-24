import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { goodsVariationUpdateSchema } from "@/lib/api/erp-validation";
import { goodsService } from "@/lib/services/goods-service";
import { z } from "zod";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    
    // Accept optional goodsId to allow validation checking if provided
    const payloadSchema = goodsVariationUpdateSchema.extend({
      goodsId: z.string().uuid().optional()
    });
    const body = payloadSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "goods",
      action: "update"
    });

    await goodsService.updateVariation(
      id,
      {
        goodsId: body.goodsId || "",
        size: body.size,
        brand: body.brand,
        isActive: body.isActive
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "goods_variations.update.api",
      entityTable: "goods_variations",
      entityId: id,
      after: body
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    authorizeApiScope(session, {
      resource: "goods",
      action: "update"
    });

    await goodsService.softDeleteVariation(id);

    await auditApiAction(request, {
      action: "goods_variations.delete.api",
      entityTable: "goods_variations",
      entityId: id
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
