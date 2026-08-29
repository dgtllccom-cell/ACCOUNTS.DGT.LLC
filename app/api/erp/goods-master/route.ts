import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { goodsService } from "@/lib/services/goods-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";

/**
 * Goods Master Registry backend (/dashboard/settings/goods-master).
 *
 * This is a FLAT view/editor over the canonical `goods` (+ `goods_variations`)
 * tables — the same rows the Goods Master Wizard and the Purchase/Sales wizards
 * use. There is deliberately no separate `goods_master` table: one goods record
 * = one row in `goods`.
 *
 *   registry field   ->  source
 *   chs_code         ->  goods.chs_code
 *   name             ->  goods.goods_name
 *   category         ->  goods.category            (20260913 migration)
 *   origin_country   ->  countries.name via goods.origin_country_id
 *   brand / sizes    ->  aggregated goods_variations.brand / .size
 *   is_active        ->  goods.is_active
 */

const createSchema = z.object({
  chsCode: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  sizes: z.string().trim().max(120).optional().nullable(),
  variety: z.string().trim().max(150).optional().nullable(),
  extraDetails: z.string().trim().max(2000).optional().nullable(),
  originCountry: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  originalLanguage: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "read" });

    const status = (request.nextUrl.searchParams.get("status") || "").toLowerCase();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 500) || 500, 1000);

    const rows = await withLocalPg(async (sql) => {
      const statusFilter =
        status === "active" ? sql`AND g.is_active = TRUE`
        : status === "inactive" ? sql`AND g.is_active = FALSE`
        : sql``;
      return await sql`
        SELECT
          g.id,
          g.chs_code,
          g.goods_name AS name,
          g.category,
          g.variety AS master_variety,
          g.extra_details AS master_extra_details,
          g.is_active,
          g.created_at,
          co.name AS origin_country,
          (
            SELECT string_agg(DISTINCT NULLIF(btrim(v.brand), ''), ' / ')
            FROM public.goods_variations v
            WHERE v.goods_id = g.id AND v.deleted_at IS NULL
          ) AS brand,
          (
            SELECT string_agg(DISTINCT NULLIF(btrim(v.size), ''), ' / ')
            FROM public.goods_variations v
            WHERE v.goods_id = g.id AND v.deleted_at IS NULL
          ) AS sizes,
          (
            SELECT string_agg(DISTINCT NULLIF(btrim(v.variety), ''), ' / ')
            FROM public.goods_variations v
            WHERE v.goods_id = g.id AND v.deleted_at IS NULL
          ) AS variation_varieties,
          (
            SELECT string_agg(DISTINCT NULLIF(btrim(v.extra_details), ''), ' | ')
            FROM public.goods_variations v
            WHERE v.goods_id = g.id AND v.deleted_at IS NULL
          ) AS variation_extra_details
        FROM public.goods g
        LEFT JOIN public.countries co ON co.id = g.origin_country_id
        WHERE g.deleted_at IS NULL
          ${statusFilter}
        ORDER BY g.created_at DESC
        LIMIT ${limit}
      `;
    });

    const list = (rows ?? []).map((r: any) => ({
      id: r.id,
      chs_code: r.chs_code,
      name: r.name,
      category: r.category ?? "",
      brand: r.brand ?? "",
      sizes: r.sizes ?? "",
      variety: r.variation_varieties || r.master_variety || "",
      extra_details: r.variation_extra_details || r.master_extra_details || "",
      origin_country: r.origin_country ?? "",
      is_active: !!r.is_active,
      created_at: r.created_at,
    }));
    const active = list.filter((g) => g.is_active).length;

    return apiOk({
      goods: list,
      summary: { total: list.length, active, inactive: list.length - active },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "create" });

    const body = createSchema.parse(await request.json());
    const lang = normalizeLanguage(body.originalLanguage, session.preferredLanguage ?? "en");

    // Resolve the origin country name -> id (registry sends the display name).
    let originCountryId: string | null = null;
    const originCountryName = body.originCountry?.trim() || null;
    if (originCountryName) {
      originCountryId = await withLocalPg(async (sql) => {
        const rows = await sql`
          SELECT id FROM public.countries
          WHERE deleted_at IS NULL AND lower(name) = lower(${originCountryName})
          LIMIT 1
        `;
        return (rows[0]?.id as string | undefined) ?? null;
      });
    }

    // Reuse the canonical service so translations, change-history and serials
    // are written exactly like the Goods Master Wizard path.
    const goodsId = await goodsService.create(
      {
        chsCode: body.chsCode,
        goodsName: body.name,
        originCountryId,
        originalLanguage: lang as never,
        initialVariation:
          body.brand || body.sizes || body.variety || body.extraDetails
            ? {
                size: body.sizes || "Standard",
                brand: body.brand || "Default",
              }
            : null,
      },
      session.userId,
    );

    // Update category, variety, extra_details, and is_active on the new goods row
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.goods
        SET category = ${body.category ?? null},
            variety = ${body.variety ?? null},
            extra_details = ${body.extraDetails ?? null},
            is_active = ${body.isActive ?? true},
            updated_at = NOW()
        WHERE id = ${goodsId}
      `;

      // Update initial variation with variety and extra_details if created
      if (body.variety || body.extraDetails) {
        await sql`
          UPDATE public.goods_variations
          SET variety = ${body.variety ?? null},
              extra_details = ${body.extraDetails ?? null},
              updated_at = NOW()
          WHERE goods_id = ${goodsId} AND deleted_at IS NULL
        `;
      }
    });

    return apiCreated({ id: goodsId });

    return apiCreated({ id: goodsId });
  } catch (error) {
    return handleApiError(error);
  }
}
