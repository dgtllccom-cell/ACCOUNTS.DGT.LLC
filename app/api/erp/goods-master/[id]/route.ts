import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { goodsService } from "@/lib/services/goods-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

const paramsSchema = z.object({ id: z.string().uuid() });

const patchSchema = z.object({
  chsCode: z.string().trim().min(1).max(60).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(120).nullable().optional(),
  originCountry: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  originalLanguage: z.string().optional(),
});

/**
 * Single Goods Master row — operates on the canonical `goods` table.
 * DELETE is a SOFT delete (sets deleted_at) and cascades to its variations;
 * no rows are physically removed.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "update" });
    const { id } = paramsSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const lang = normalizeLanguage(body.originalLanguage, session.preferredLanguage ?? "en");

    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id FROM public.goods WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
      return rows.length > 0;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods record not found.", 404);

    let originCountryId: string | null | undefined;
    if (body.originCountry !== undefined) {
      const originCountryName = body.originCountry?.trim() || null;
      originCountryId = originCountryName
        ? await withLocalPg(async (sql) => {
            const rows = await sql`SELECT id FROM public.countries WHERE deleted_at IS NULL AND lower(name) = lower(${originCountryName}) LIMIT 1`;
            return (rows[0]?.id as string | undefined) ?? null;
          })
        : null;
    }

    if (body.chsCode !== undefined || body.name !== undefined || originCountryId !== undefined || body.isActive !== undefined) {
      await goodsService.update(
        id,
        {
          chsCode: body.chsCode,
          goodsName: body.name,
          originCountryId,
          isActive: body.isActive,
          originalLanguage: lang as never,
        },
        session.userId,
      );
    }

    if (body.category !== undefined) {
      await withLocalPg(async (sql) => {
        await sql`UPDATE public.goods SET category = ${body.category ?? null}, updated_at = NOW() WHERE id = ${id}`;
      });
    }

    return apiOk({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "delete" });
    const { id } = paramsSchema.parse(await ctx.params);

    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id FROM public.goods WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
      return rows.length > 0;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods record not found.", 404);

    // Soft delete the goods row (writes record-change history) + its variations.
    await goodsService.softDelete(id);
    await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods_variations SET deleted_at = NOW(), updated_at = NOW() WHERE goods_id = ${id} AND deleted_at IS NULL`;
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
