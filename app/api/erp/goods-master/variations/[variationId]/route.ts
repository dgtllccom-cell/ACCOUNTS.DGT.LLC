import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { goodsService } from "@/lib/services/goods-service";
import { auditApiAction } from "@/lib/api/audit";

const paramsSchema = z.object({ variationId: z.string().uuid() });

const updateVariationSchema = z.object({
  brand: z.string().trim().min(1).max(100).optional(),
  size: z.string().trim().min(1).max(100).optional(),
  extraDetails: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ variationId: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "update" });
    const { variationId } = paramsSchema.parse(await ctx.params);
    const body = updateVariationSchema.parse(await request.json());

    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id, goods_id FROM public.goods_variations WHERE id = ${variationId}::uuid AND deleted_at IS NULL LIMIT 1`;
      return rows[0] as { id: string; goods_id: string } | undefined;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods variation not found.", 404);

    await goodsService.updateVariation(
      variationId,
      {
        goodsId: exists.goods_id,
        brand: body.brand,
        size: body.size,
        extraDetails: body.extraDetails,
        isActive: body.isActive,
        originalLanguage: session.preferredLanguage,
      },
      session.userId,
    );

    await auditApiAction(request, {
      action: "goods_variations.update.api",
      entityTable: "goods_variations",
      entityId: variationId,
      after: body,
    });

    return apiOk({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ variationId: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "update" });
    const { variationId } = paramsSchema.parse(await ctx.params);

    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id FROM public.goods_variations WHERE id = ${variationId}::uuid AND deleted_at IS NULL LIMIT 1`;
      return rows.length > 0;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods variation not found.", 404);

    await goodsService.softDeleteVariation(variationId);

    await auditApiAction(request, {
      action: "goods_variations.delete.api",
      entityTable: "goods_variations",
      entityId: variationId,
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
