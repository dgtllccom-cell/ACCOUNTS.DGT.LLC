import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, apiCreated, handleApiError, apiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { goodsService } from "@/lib/services/goods-service";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";

const paramsSchema = z.object({ id: z.string().uuid() });

const createVariationSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  size: z.string().trim().min(1).max(100),
  variety: z.string().trim().max(100).optional().nullable(),
  extraDetails: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "read" });
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const { id } = paramsSchema.parse(await ctx.params);

    const variations = await withLocalPg(async (sql) => {
      return await sql`
        SELECT
          id,
          goods_id,
          size,
          brand,
          extra_details,
          variety,
          is_active,
          created_at
        FROM public.goods_variations
        WHERE goods_id = ${id}::uuid
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `;
    });

    return apiOk({ variations: variations ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    
    // Allow if user has update permission on goods/goods_variation/purchases
    let authorized = false;
    const scopesToTry = [
      { resource: "goods", action: "update" },
      { resource: "goods", action: "create" },
      { resource: "goods_variation", action: "create" },
      { resource: "goods_variation", action: "update" },
      { resource: "goods_master", action: "update" },
      { resource: "inventory", action: "create" },
      { resource: "inventory", action: "update" },
      { resource: "purchases", action: "create" },
    ];
    for (const scope of scopesToTry) {
      try {
        authorizeApiScope(session, scope);
        authorized = true;
        break;
      } catch {
        // try next
      }
    }
    if (!authorized) {
      authorizeApiScope(session, { resource: "goods", action: "update" });
    }

    const { id: goodsId } = paramsSchema.parse(await ctx.params);
    const body = createVariationSchema.parse(await request.json());

    // Check if master goods item exists
    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id FROM public.goods WHERE id = ${goodsId}::uuid AND deleted_at IS NULL LIMIT 1`;
      return rows.length > 0;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods master item not found.", 404);

    const variationId = await goodsService.createVariation(
      {
        goodsId,
        size: body.size,
        brand: body.brand,
        variety: body.variety,
        extraDetails: body.extraDetails,
        originalLanguage: session.preferredLanguage,
      },
      session.userId,
    );

    await auditApiAction(request, {
      action: "goods_variations.create.api",
      entityTable: "goods_variations",
      entityId: variationId,
      after: {
        goodsId,
        size: body.size,
        brand: body.brand,
        variety: body.variety,
        extraDetails: body.extraDetails,
      },
    });

    return apiCreated({ variationId });
  } catch (error) {
    return handleApiError(error);
  }
}
