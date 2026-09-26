import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { auditApiAction } from "@/lib/api/audit";

const paramsSchema = z.object({ id: z.string().uuid() });

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("renameVariety"),
    oldVariety: z.string().trim(),
    newVariety: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("renameSize"),
    variety: z.string().trim().optional().nullable(),
    oldSize: z.string().trim(),
    newSize: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("renameGrade"),
    variety: z.string().trim().optional().nullable(),
    size: z.string().trim(),
    oldGrade: z.string().trim(),
    newGrade: z.string().trim().min(1).max(150),
  }),
  z.object({
    action: z.literal("renameBrand"),
    variety: z.string().trim().optional().nullable(),
    size: z.string().trim(),
    grade: z.string().trim().optional().nullable(),
    oldBrand: z.string().trim(),
    newBrand: z.string().trim().min(1).max(100),
  }),
  z.object({
    action: z.literal("addNode"),
    level: z.enum(["variety", "size", "grade", "brand"]),
    variety: z.string().trim().optional().nullable(),
    size: z.string().trim().optional().nullable(),
    grade: z.string().trim().optional().nullable(),
    brand: z.string().trim().optional().nullable(),
    extraDetails: z.string().trim().optional().nullable(),
  }),
  z.object({
    action: z.literal("deleteNode"),
    level: z.enum(["variety", "size", "grade", "brand"]),
    variety: z.string().trim().optional().nullable(),
    size: z.string().trim().optional().nullable(),
    grade: z.string().trim().optional().nullable(),
    brand: z.string().trim().optional().nullable(),
  }),
  z.object({
    action: z.literal("updateExtraDetails"),
    variationId: z.string().uuid(),
    extraDetails: z.string().trim(),
  }),
]);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "goods", action: "update" });

    const { id: goodsId } = paramsSchema.parse(await ctx.params);
    const body = actionSchema.parse(await request.json());

    // Check if good exists
    const exists = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT id FROM public.goods WHERE id = ${goodsId}::uuid AND deleted_at IS NULL LIMIT 1`;
      return rows.length > 0;
    });
    if (!exists) return apiError("NOT_FOUND", "Goods master item not found.", 404);

    if (body.action === "renameVariety") {
      await withLocalPg(async (sql) => {
        if (!body.oldVariety) {
          await sql`
            UPDATE public.goods_variations
            SET variety = ${body.newVariety}, updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              AND (variety IS NULL OR btrim(variety) = '')
              AND deleted_at IS NULL
          `;
        } else {
          await sql`
            UPDATE public.goods_variations
            SET variety = ${body.newVariety}, updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              AND lower(btrim(variety)) = lower(${body.oldVariety.trim()})
              AND deleted_at IS NULL
          `;
        }
      });
    } else if (body.action === "renameSize") {
      await withLocalPg(async (sql) => {
        const varietyFilter =
          body.variety && body.variety.trim()
            ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
            : sql`AND (variety IS NULL OR btrim(variety) = '')`;

        await sql`
          UPDATE public.goods_variations
          SET size = ${body.newSize}, updated_at = NOW()
          WHERE goods_id = ${goodsId}::uuid
            ${varietyFilter}
            AND lower(btrim(size)) = lower(${body.oldSize.trim()})
            AND deleted_at IS NULL
        `;
      });
    } else if (body.action === "renameGrade") {
      await withLocalPg(async (sql) => {
        const varietyFilter =
          body.variety && body.variety.trim()
            ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
            : sql`AND (variety IS NULL OR btrim(variety) = '')`;

        const oldGrade = body.oldGrade.trim().toLowerCase();
        const gradeFilter =
          oldGrade === "standard" || !oldGrade
            ? sql`AND (grade IS NULL OR btrim(grade) = '' OR lower(btrim(grade)) = 'standard')`
            : sql`AND lower(btrim(grade)) = ${oldGrade}`;

        await sql`
          UPDATE public.goods_variations
          SET grade = ${body.newGrade}, updated_at = NOW()
          WHERE goods_id = ${goodsId}::uuid
            ${varietyFilter}
            AND lower(btrim(size)) = lower(${body.size.trim()})
            ${gradeFilter}
            AND deleted_at IS NULL
        `;
      });
    } else if (body.action === "renameBrand") {
      await withLocalPg(async (sql) => {
        const varietyFilter =
          body.variety && body.variety.trim()
            ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
            : sql`AND (variety IS NULL OR btrim(variety) = '')`;

        const gradeVal = (body.grade || "").trim().toLowerCase();
        const gradeFilter =
          !gradeVal || gradeVal === "standard"
            ? sql`AND (grade IS NULL OR btrim(grade) = '' OR lower(btrim(grade)) = 'standard')`
            : sql`AND lower(btrim(grade)) = ${gradeVal}`;

        await sql`
          UPDATE public.goods_variations
          SET brand = ${body.newBrand}, updated_at = NOW()
          WHERE goods_id = ${goodsId}::uuid
            ${varietyFilter}
            AND lower(btrim(size)) = lower(${body.size.trim()})
            ${gradeFilter}
            AND lower(btrim(brand)) = lower(${body.oldBrand.trim()})
            AND deleted_at IS NULL
        `;
      });
    } else if (body.action === "addNode") {
      const variety = body.variety?.trim() || "Standard";
      const size = body.size?.trim() || "Standard";
      const grade = body.grade?.trim() || "Standard Grade";
      const brand = body.brand?.trim() || "Default";
      const extraDetails = body.extraDetails?.trim() || null;

      await withLocalPg(async (sql) => {
        await sql`
          INSERT INTO public.goods_variations (goods_id, variety, size, grade, brand, extra_details, is_active, created_by)
          VALUES (${goodsId}::uuid, ${variety}, ${size}, ${grade}, ${brand}, ${extraDetails}, true, ${session.userId || null})
        `;
      });
    } else if (body.action === "deleteNode") {
      await withLocalPg(async (sql) => {
        if (body.level === "variety") {
          const varietyFilter =
            body.variety && body.variety.trim()
              ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
              : sql`AND (variety IS NULL OR btrim(variety) = '')`;
          await sql`
            UPDATE public.goods_variations
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              ${varietyFilter}
              AND deleted_at IS NULL
          `;
        } else if (body.level === "size") {
          const varietyFilter =
            body.variety && body.variety.trim()
              ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
              : sql`AND (variety IS NULL OR btrim(variety) = '')`;
          await sql`
            UPDATE public.goods_variations
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              ${varietyFilter}
              AND lower(btrim(size)) = lower(${body.size?.trim() || ""})
              AND deleted_at IS NULL
          `;
        } else if (body.level === "grade") {
          const varietyFilter =
            body.variety && body.variety.trim()
              ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
              : sql`AND (variety IS NULL OR btrim(variety) = '')`;
          const gradeVal = (body.grade || "").trim().toLowerCase();
          const gradeFilter =
            !gradeVal || gradeVal === "standard"
              ? sql`AND (grade IS NULL OR btrim(grade) = '' OR lower(btrim(grade)) = 'standard')`
              : sql`AND lower(btrim(grade)) = ${gradeVal}`;
          await sql`
            UPDATE public.goods_variations
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              ${varietyFilter}
              AND lower(btrim(size)) = lower(${body.size?.trim() || ""})
              ${gradeFilter}
              AND deleted_at IS NULL
          `;
        } else if (body.level === "brand") {
          const varietyFilter =
            body.variety && body.variety.trim()
              ? sql`AND lower(btrim(variety)) = lower(${body.variety.trim()})`
              : sql`AND (variety IS NULL OR btrim(variety) = '')`;
          const gradeVal = (body.grade || "").trim().toLowerCase();
          const gradeFilter =
            !gradeVal || gradeVal === "standard"
              ? sql`AND (grade IS NULL OR btrim(grade) = '' OR lower(btrim(grade)) = 'standard')`
              : sql`AND lower(btrim(grade)) = ${gradeVal}`;
          await sql`
            UPDATE public.goods_variations
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE goods_id = ${goodsId}::uuid
              ${varietyFilter}
              AND lower(btrim(size)) = lower(${body.size?.trim() || ""})
              ${gradeFilter}
              AND lower(btrim(brand)) = lower(${body.brand?.trim() || ""})
              AND deleted_at IS NULL
          `;
        }
      });
    } else if (body.action === "updateExtraDetails") {
      await withLocalPg(async (sql) => {
        await sql`
          UPDATE public.goods_variations
          SET extra_details = ${body.extraDetails}, updated_at = NOW()
          WHERE id = ${body.variationId}::uuid
            AND goods_id = ${goodsId}::uuid
            AND deleted_at IS NULL
        `;
      });
    }

    await auditApiAction(request, {
      action: "goods.hierarchy.update.api",
      entityTable: "goods_variations",
      entityId: goodsId,
      after: body,
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
