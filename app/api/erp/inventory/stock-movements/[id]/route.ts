import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "read" });

    const id = (await params).id;
    const movement = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT 
          sm.*,
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
        WHERE sm.id = ${id}::uuid AND sm.deleted_at IS NULL
      `;
      return rows[0] || null;
    });

    if (!movement) {
      return new Response(JSON.stringify({ error: "Stock movement not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!session.isSuperAdmin && movement.country_id && !session.countryIds.includes(movement.country_id)) {
      return new Response(JSON.stringify({ error: "Not authorized for this country scope" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    return apiOk({ movement });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "inventory", action: "update" });

    const id = (await params).id;
    const body = await request.json();

    const updatedMovement = await withLocalPg(async (sql) => {
      // 1. Fetch current movement
      const currentRows = await sql`
        SELECT * FROM public.stock_movements WHERE id = ${id}::uuid AND deleted_at IS NULL
      `;
      const current = currentRows[0];
      if (!current) return null;

      if (!session.isSuperAdmin && current.country_id && !session.countryIds.includes(current.country_id)) {
        throw new Error("403: Not authorized for this country scope");
      }

      const newNotes = body.notes !== undefined ? String(body.notes).trim() : current.notes;
      const newRefNo = body.referenceNo !== undefined ? String(body.referenceNo).trim() : current.reference_no;
      const newQuantity = body.quantity !== undefined ? Number(body.quantity) : Number(current.quantity);
      const newUnitCost = body.unitCost !== undefined ? Number(body.unitCost) : Number(current.unit_cost);
      const newTotalAmount = newQuantity * newUnitCost;
      const now = new Date().toISOString();

      // Recalculate balance if quantity changed
      const oldQuantity = Number(current.quantity);
      const oldType = current.movement_type;
      const oldDelta = (oldType === 'STOCK_IN' || oldType === 'ADJUSTMENT') ? oldQuantity : -oldQuantity;
      const newDelta = (oldType === 'STOCK_IN' || oldType === 'ADJUSTMENT') ? newQuantity : -newQuantity;
      const netChange = newDelta - oldDelta;

      // Update movement
      const updatedRows = await sql`
        UPDATE public.stock_movements
        SET
          notes = ${newNotes},
          reference_no = ${newRefNo},
          quantity = ${newQuantity},
          unit_cost = ${newUnitCost},
          total_amount = ${newTotalAmount},
          updated_at = ${now}
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      if (netChange !== 0) {
        await sql`
          UPDATE public.product_inventory_balances
          SET
            quantity_on_hand = GREATEST(0, quantity_on_hand + ${netChange}),
            updated_at = ${now}
          WHERE product_id = ${current.goods_id}::uuid AND warehouse_id = ${current.warehouse_id}::uuid
        `;
      }

      return updatedRows[0];
    });

    if (!updatedMovement) {
      return new Response(JSON.stringify({ error: "Stock movement not found or not editable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return apiOk({ movement: updatedMovement });
  } catch (error) {
    return handleApiError(error);
  }
}
