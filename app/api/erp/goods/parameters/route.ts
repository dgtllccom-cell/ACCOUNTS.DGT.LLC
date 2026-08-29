import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

const createParamSchema = z.object({
  goodsId: z.string().uuid().optional().nullable(),
  paramType: z.enum(["brand", "size", "variety", "extra_details"]),
  paramCode: z.string().trim().max(100).optional().nullable(),
  paramValue: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateParamSchema = z.object({
  id: z.string().uuid(),
  paramValue: z.string().trim().min(1).max(500).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const goodsId = searchParams.get("goodsId") || null;
    const paramType = searchParams.get("paramType") || null;
    const goodsName = searchParams.get("goodsName") || null;

    const rows = await withLocalPg(async (sql) => {
      let targetGoodsId = goodsId;

      if (!targetGoodsId && goodsName) {
        const goodsMatch = await sql`
          SELECT id FROM public.goods 
          WHERE deleted_at IS NULL AND lower(goods_name) LIKE lower(${`%${goodsName}%`})
          LIMIT 1
        `;
        targetGoodsId = (goodsMatch[0]?.id as string | undefined) ?? null;
      }

      return await sql`
        SELECT 
          p.id,
          p.goods_id,
          p.param_type,
          p.param_code,
          p.param_value,
          p.sort_order,
          p.is_active,
          p.created_at,
          g.goods_name
        FROM public.goods_master_parameters p
        LEFT JOIN public.goods g ON g.id = p.goods_id
        WHERE p.deleted_at IS NULL
          ${targetGoodsId ? sql`AND (p.goods_id = ${targetGoodsId}::uuid OR p.goods_id IS NULL)` : sql``}
          ${paramType ? sql`AND p.param_type = ${paramType}` : sql``}
        ORDER BY p.param_type ASC, p.sort_order ASC, p.param_value ASC
      `;
    });

    const parameters = rows ?? [];
    
    // Group parameters by type
    const brands = parameters.filter((p: any) => p.param_type === "brand" && p.is_active);
    const sizes = parameters.filter((p: any) => p.param_type === "size" && p.is_active);
    const varieties = parameters.filter((p: any) => p.param_type === "variety" && p.is_active);
    const extraDetails = parameters.filter((p: any) => p.param_type === "extra_details" && p.is_active);

    return apiOk({
      parameters,
      grouped: {
        brands: brands.map((b: any) => b.param_value),
        sizes: sizes.map((s: any) => s.param_value),
        varieties: varieties.map((v: any) => v.param_value),
        extraDetails: extraDetails.map((e: any) => e.param_value),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "create" });

    const body = createParamSchema.parse(await request.json());

    const paramId = await withLocalPg(async (sql) => {
      let goodsId = body.goodsId;

      // Default to Almond Kernel if no goodsId supplied
      if (!goodsId) {
        const goodsRow = await sql`
          SELECT id FROM public.goods 
          WHERE chs_code = '0802.12.0000' OR lower(goods_name) LIKE '%almond%' 
          LIMIT 1
        `;
        goodsId = goodsRow[0]?.id as string | undefined;
      }

      const rows = await sql`
        INSERT INTO public.goods_master_parameters (
          goods_id,
          param_type,
          param_code,
          param_value,
          sort_order,
          is_active,
          created_by
        ) VALUES (
          ${goodsId ?? null},
          ${body.paramType},
          ${body.paramCode ?? `PRM-${Date.now()}`},
          ${body.paramValue},
          ${body.sortOrder},
          ${body.isActive},
          ${session.userId}
        )
        RETURNING id
      `;
      return rows[0]?.id as string;
    });

    return apiCreated({ id: paramId });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "update" });

    const body = updateParamSchema.parse(await request.json());

    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.goods_master_parameters
        SET 
          param_value = COALESCE(${body.paramValue ?? null}, param_value),
          sort_order = COALESCE(${body.sortOrder ?? null}, sort_order),
          is_active = COALESCE(${body.isActive ?? null}, is_active),
          updated_at = NOW()
        WHERE id = ${body.id} AND deleted_at IS NULL
      `;
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "delete" });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    if (!id) throw new Error("Parameter ID required for deletion.");

    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.goods_master_parameters
        SET deleted_at = NOW(), is_active = false
        WHERE id = ${id}
      `;
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
