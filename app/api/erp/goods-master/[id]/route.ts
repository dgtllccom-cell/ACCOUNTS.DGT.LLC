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
  originCountryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  originalLanguage: z.string().optional(),
});

/**
 * Single Goods Master row — operates on the canonical `goods` table.
 * GET returns the goods row with its linked variations and master parameters.
 * PATCH updates the goods row.
 * DELETE is a SOFT delete (sets deleted_at) and cascades to its variations;
 * no rows are physically removed.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "read" });
    const { id } = paramsSchema.parse(await ctx.params);

    const data = await withLocalPg(async (sql) => {
      const goodsRows = await sql`
        SELECT
          g.id,
          g.chs_code,
          g.goods_name AS name,
          g.category,
          g.variety AS master_variety,
          g.extra_details AS master_extra_details,
          g.origin_country_id,
          g.is_active,
          g.created_at,
          co.name AS origin_country
        FROM public.goods g
        LEFT JOIN public.countries co ON co.id = g.origin_country_id
        WHERE g.id = ${id}::uuid AND g.deleted_at IS NULL
        LIMIT 1
      `;
      if (!goodsRows.length) return null;

      const variations = await sql`
        SELECT
          id,
          goods_id,
          size,
          brand,
          variety,
          extra_details,
          is_active,
          created_at
        FROM public.goods_variations
        WHERE goods_id = ${id}::uuid AND deleted_at IS NULL
        ORDER BY created_at ASC
      `;

      const parameters = await sql`
        SELECT
          id,
          goods_id,
          param_type,
          param_code,
          param_value,
          sort_order,
          is_active,
          created_at
        FROM public.goods_master_parameters
        WHERE (goods_id = ${id}::uuid OR goods_id IS NULL)
          AND deleted_at IS NULL
        ORDER BY param_type ASC, sort_order ASC, param_value ASC
      `;

      return {
        goods: goodsRows[0],
        variations: variations ?? [],
        parameters: parameters ?? [],
      };
    });

    if (!data) return apiError("NOT_FOUND", "Goods record not found.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
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

    let originCountryId: string | null | undefined = body.originCountryId;
    if (originCountryId === undefined && body.originCountry !== undefined) {
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
    await goodsService.softDelete(id, session.userId);
    await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods_variations SET deleted_at = NOW(), updated_at = NOW() WHERE goods_id = ${id} AND deleted_at IS NULL`;
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
