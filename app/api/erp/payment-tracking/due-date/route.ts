export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeIsoDate } from "@/lib/services/payment-due-tracking";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

const updateDueDateSchema = z.object({
  module: z.enum(["purchase", "sales"]),
  orderType: z.enum(["purchase_order", "local_purchase", "sales_order"]).optional(),
  orderId: z.string().uuid(),
  agreedDueDate: z.string().nullable().optional(),
  dueType: z.enum(["general", "advance", "remaining", "credit"]).default("general")
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const parsed = updateDueDateSchema.parse(body);

    const newDate = normalizeIsoDate(parsed.agreedDueDate);

    const result = await withLocalPg(async (sql) => {
      if (parsed.module === "purchase") {
        if (parsed.orderType === "local_purchase") {
          const [updated] = await sql`
            UPDATE public.local_purchases
            SET 
              loading_details = jsonb_set(coalesce(loading_details, '{}'::jsonb), '{dueDate}', ${sql.json(newDate)}::jsonb),
              updated_at = NOW()
            WHERE id = ${parsed.orderId}::uuid AND deleted_at IS NULL
            RETURNING id, manual_bill_no;
          `;
          return { id: updated?.id, refNo: updated?.manual_bill_no, dueDate: newDate };
        } else {
          // Standard purchase_orders
          const [po] = await sql`
            SELECT id, purchase_order_no, form_data
            FROM public.purchase_orders
            WHERE id = ${parsed.orderId}::uuid AND deleted_at IS NULL
            LIMIT 1;
          `;
          if (!po) throw new Error("Purchase order not found.");

          const formData = po.form_data || {};
          const form = formData.form || {};

          form.agreedDueDate = newDate;
          form.dueDate = newDate;
          form.paymentDueDate = newDate;
          if (parsed.dueType === "advance") {
            form.advDueDate = newDate;
            form.advancePaymentDueDate = newDate;
          } else if (parsed.dueType === "remaining") {
            form.remainingDueDate = newDate;
            form.remainingPaymentDueDate = newDate;
          }

          formData.form = form;

          const [updated] = await sql`
            UPDATE public.purchase_orders
            SET 
              form_data = ${sql.json(formData)},
              updated_at = NOW()
            WHERE id = ${parsed.orderId}::uuid
            RETURNING id, purchase_order_no;
          `;

          // Record audit event
          try {
            await sql`
              INSERT INTO public.enterprise_audit_events (
                actor_id, actor_name, action, target_type, target_id, details
              ) VALUES (
                ${(session as any).user?.id || session.userId}::uuid,
                ${(session as any).user?.fullName || session.fullName || session.email || "User"},
                'UPDATE_AGREED_DUE_DATE',
                'purchase_orders',
                ${parsed.orderId}::uuid,
                ${sql.json({
                  purchaseOrderNo: po.purchase_order_no,
                  newDueDate: newDate,
                  dueType: parsed.dueType
                })}
              );
            `;
          } catch {
            // non-fatal if audit table differs in sandbox
          }

          return { id: updated?.id, refNo: updated?.purchase_order_no, dueDate: newDate };
        }
      } else {
        // Sales order
        const [so] = await sql`
          SELECT id, sales_order_no, form_data
          FROM public.sales_orders
          WHERE id = ${parsed.orderId}::uuid AND deleted_at IS NULL
          LIMIT 1;
        `;
        if (!so) throw new Error("Sales order not found.");

        const formData = so.form_data || {};
        const form = formData.form || {};

        form.agreedDueDate = newDate;
        form.dueDate = newDate;
        form.paymentDueDate = newDate;
        if (parsed.dueType === "advance") {
          form.advDueDate = newDate;
        } else if (parsed.dueType === "remaining") {
          form.remainingDueDate = newDate;
        }

        formData.form = form;

        const [updated] = await sql`
          UPDATE public.sales_orders
          SET 
            form_data = ${sql.json(formData)},
            updated_at = NOW()
          WHERE id = ${parsed.orderId}::uuid
          RETURNING id, sales_order_no;
        `;

        try {
          await sql`
            INSERT INTO public.enterprise_audit_events (
              actor_id, actor_name, action, target_type, target_id, details
            ) VALUES (
              ${(session as any).user?.id || session.userId}::uuid,
              ${(session as any).user?.fullName || session.fullName || session.email || "User"},
              'UPDATE_AGREED_DUE_DATE',
              'sales_orders',
              ${parsed.orderId}::uuid,
              ${sql.json({
                salesOrderNo: so.sales_order_no,
                newDueDate: newDate,
                dueType: parsed.dueType
              })}
            );
          `;
        } catch {
          // non-fatal
        }

        return { id: updated?.id, refNo: updated?.sales_order_no, dueDate: newDate };
      }
    });

    return NextResponse.json({
      success: true,
      message: "Agreed payment due date updated successfully.",
      data: result
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json(
      { error: err?.message || "Failed to update agreed payment due date." },
      { status: 400 }
    );
  }
}
