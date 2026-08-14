import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const movementType = searchParams.get("movementType")?.trim();
    const warehouseId = searchParams.get("warehouseId")?.trim();
    const goodsId = searchParams.get("goodsId")?.trim();
    const limit = Number(searchParams.get("limit") || "100");
    const offset = Number(searchParams.get("offset") || "0");

    const result = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT 
          sm.id,
          sm.movement_type,
          sm.goods_id,
          sm.goods_variation_id,
          sm.warehouse_id,
          sm.country_id,
          sm.country_branch_id,
          sm.city_branch_id,
          sm.quantity,
          sm.unit_cost,
          sm.total_amount,
          sm.reference_no,
          sm.notes,
          sm.movement_date,
          sm.created_at,
          sm.super_admin_serial,
          sm.country_serial,
          sm.branch_serial,
          sm.entry_serial,
          g.goods_name,
          g.chs_code,
          gv.size AS variation_size,
          gv.brand AS variation_brand,
          w.warehouse_name,
          w.warehouse_code,
          c.name AS country_name
        FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.goods_variations gv ON gv.id = sm.goods_variation_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
        LEFT JOIN public.countries c ON c.id = sm.country_id
        WHERE sm.deleted_at IS NULL
      `;

      if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
        query = sql`${query} AND (sm.country_id IS NULL OR sm.country_id = ANY(${session.countryIds}::uuid[]))`;
      }

      if (movementType) {
        query = sql`${query} AND sm.movement_type = ${movementType}`;
      }

      if (warehouseId) {
        query = sql`${query} AND sm.warehouse_id = ${warehouseId}::uuid`;
      }

      if (goodsId) {
        query = sql`${query} AND sm.goods_id = ${goodsId}::uuid`;
      }

      if (q) {
        const searchPattern = `%${q}%`;
        query = sql`${query} AND (
          g.goods_name ILIKE ${searchPattern} OR 
          g.chs_code ILIKE ${searchPattern} OR 
          w.warehouse_name ILIKE ${searchPattern} OR 
          sm.reference_no ILIKE ${searchPattern} OR 
          sm.notes ILIKE ${searchPattern}
        )`;
      }

      const rows = await sql`
        ${query}
        ORDER BY sm.movement_date DESC, sm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countRows = await sql`
        SELECT COUNT(*) as total FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
        WHERE sm.deleted_at IS NULL
        ${!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0 ? sql`AND (sm.country_id IS NULL OR sm.country_id = ANY(${session.countryIds}::uuid[]))` : sql``}
        ${movementType ? sql`AND sm.movement_type = ${movementType}` : sql``}
        ${warehouseId ? sql`AND sm.warehouse_id = ${warehouseId}::uuid` : sql``}
        ${goodsId ? sql`AND sm.goods_id = ${goodsId}::uuid` : sql``}
      `;

      return {
        movements: rows,
        total: Number(countRows[0]?.total || 0)
      };
    });

    return apiOk(result || { movements: [], total: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "create" });

    const body = await request.json();
    const movementType = body.movementType; // 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'TRANSFER'
    const goodsId = body.goodsId;
    const goodsVariationId = body.goodsVariationId || null;
    const warehouseId = body.warehouseId;
    const quantity = Number(body.quantity || 0);
    const unitCost = Number(body.unitCost || 0);
    const referenceNo = body.referenceNo ? String(body.referenceNo).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!movementType || !['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER'].includes(movementType)) {
      return new Response(JSON.stringify({ error: "Valid movementType is required (STOCK_IN, STOCK_OUT, ADJUSTMENT, TRANSFER)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!goodsId || !warehouseId || quantity <= 0) {
      return new Response(JSON.stringify({ error: "goodsId, warehouseId, and positive quantity are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const totalAmount = quantity * unitCost;
    const now = new Date().toISOString();

    const createdMovement = await withLocalPg(async (sql) => {
      // 1. Fetch goods details
      const goodsRows = await sql`SELECT goods_name, chs_code FROM public.goods WHERE id = ${goodsId}::uuid`;
      const goodsName = goodsRows[0]?.goods_name || "Goods Item";
      const chsCode = goodsRows[0]?.chs_code || "PRD-" + goodsId.slice(0, 8);

      // 2. Fetch warehouse details for country_id fallback
      const whRows = await sql`SELECT country_id FROM public.warehouses WHERE id = ${warehouseId}::uuid`;
      const whCountryId = whRows[0]?.country_id || null;

      let fallbackCountryId = body.countryId || session.activeCountryId || session.countryIds?.[0] || whCountryId;
      if (!fallbackCountryId) {
        const cRows = await sql`SELECT id FROM public.countries ORDER BY created_at ASC LIMIT 1`;
        fallbackCountryId = cRows[0]?.id || null;
      }

      if (!session.isSuperAdmin && fallbackCountryId && !session.countryIds.includes(fallbackCountryId)) {
        throw new Error("403: Not authorized for this country scope");
      }

      const countryBranchId = body.countryBranchId || session.activeBranchId || null;
      const cityBranchId = body.cityBranchId || null;

      // 3. Ensure shadow record in public.products table for FK constraint in product_inventory_balances
      await sql`
        INSERT INTO public.products (id, product_code, product_name, hs_code, country_id, is_active, created_at, updated_at)
        VALUES (${goodsId}::uuid, ${chsCode}, ${goodsName}, ${chsCode}, ${fallbackCountryId}::uuid, true, ${now}, ${now})
        ON CONFLICT (id) DO NOTHING
      `;

      // 4. Insert stock_movement
      const rows = await sql`
        INSERT INTO public.stock_movements (
          movement_type,
          goods_id,
          goods_variation_id,
          warehouse_id,
          country_id,
          country_branch_id,
          city_branch_id,
          quantity,
          unit_cost,
          total_amount,
          reference_no,
          notes,
          movement_date,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          ${movementType},
          ${goodsId}::uuid,
          ${goodsVariationId ? sql`${goodsVariationId}::uuid` : null},
          ${warehouseId}::uuid,
          ${fallbackCountryId ? sql`${fallbackCountryId}::uuid` : null},
          ${countryBranchId ? sql`${countryBranchId}::uuid` : null},
          ${cityBranchId ? sql`${cityBranchId}::uuid` : null},
          ${quantity},
          ${unitCost},
          ${totalAmount},
          ${referenceNo},
          ${notes},
          ${body.movementDate ? new Date(body.movementDate).toISOString() : now},
          ${session.userId ? sql`${session.userId}::uuid` : null},
          ${now},
          ${now}
        )
        RETURNING *
      `;
      const movement = rows[0];

      // 5. Update or insert product_inventory_balances
      const isIncrease = movementType === 'STOCK_IN' || (movementType === 'ADJUSTMENT' && quantity > 0);
      const delta = isIncrease ? quantity : -quantity;

      await sql`
        INSERT INTO public.product_inventory_balances (
          product_id,
          country_id,
          country_branch_id,
          city_branch_id,
          warehouse_id,
          quantity_on_hand,
          quantity_reserved,
          updated_at
        ) VALUES (
          ${goodsId}::uuid,
          ${fallbackCountryId}::uuid,
          ${countryBranchId ? sql`${countryBranchId}::uuid` : null},
          ${cityBranchId ? sql`${cityBranchId}::uuid` : null},
          ${warehouseId}::uuid,
          ${Math.max(0, delta)},
          0,
          ${now}
        )
        ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
          quantity_on_hand = GREATEST(0, public.product_inventory_balances.quantity_on_hand + ${delta}),
          updated_at = ${now}
      `;

      return movement;
    });

    return apiOk({ movement: createdMovement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
