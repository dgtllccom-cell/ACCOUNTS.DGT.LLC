import { smartDueSourceSql } from "@/lib/services/smart-due-access";
import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { getCurrentErpSession, ErpAuthError } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentErpSession();
    if (!session) throw new ErpAuthError();
    const params = request.nextUrl.searchParams;
    const countryId = params.get("countryId") || null;
    const countryBranchId = params.get("countryBranchId") || null;
    const cityBranchId = params.get("cityBranchId") || null;

    const isShipping = session.isShippingScoped;

    const result = await withLocalPg(async (sql) => {


      const explicitWhere = cityBranchId
        ? sql`city_branch_id = ${cityBranchId}`
        : countryBranchId
          ? sql`country_branch_id = ${countryBranchId}`
          : countryId
            ? sql`country_id = ${countryId}`
            : sql`true`;

      const rows = await sql`
        WITH cheques AS (
          SELECT
            CASE
              WHEN status IN ('cleared','dishonored') THEN 'completed'
              WHEN due_date IS NULL THEN 'pending'
              WHEN due_date < CURRENT_DATE THEN 'overdue'
              WHEN due_date = CURRENT_DATE THEN 'due_today'
              WHEN due_date = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class
          FROM public.bank_cheque_transactions
          WHERE deleted_at IS NULL AND status NOT IN ('cleared','dishonored')
            AND (${smartDueSourceSql(sql, session, "cheques")}) AND (${explicitWhere})
        )
        , purchases AS (
          SELECT 'pending' AS urgency_class
          FROM public.purchase_orders
          WHERE deleted_at IS NULL AND payment_status::text NOT IN ('completed','cancelled') AND remaining_due > 0
            AND (${smartDueSourceSql(sql, session, "purchases")}) AND (${explicitWhere})
        )
        , sales AS (
          SELECT 'pending' AS urgency_class
          FROM public.sales_orders
          WHERE deleted_at IS NULL AND payment_status NOT IN ('completed','paid','cancelled') AND remaining_amount > 0
            AND (${smartDueSourceSql(sql, session, "sales")}) AND (${explicitWhere})
        )
        , shipping_bl AS (
          SELECT
            CASE
              WHEN shipment_status IN ('delivered','completed') THEN 'completed'
              WHEN eta IS NULL THEN 'pending'
              WHEN eta < CURRENT_DATE THEN 'overdue'
              WHEN eta = CURRENT_DATE THEN 'due_today'
              WHEN eta = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class
          FROM public.shipping_bl_records
          WHERE deleted_at IS NULL AND shipment_status NOT IN ('delivered','completed')
            AND (${smartDueSourceSql(sql, session, "shipping_bl")}) AND (${explicitWhere})
        )
        , shipping_line AS (
          SELECT
            CASE
              WHEN shipment_status IN ('delivered','completed') THEN 'completed'
              WHEN eta IS NULL THEN 'pending'
              WHEN eta < CURRENT_DATE THEN 'overdue'
              WHEN eta = CURRENT_DATE THEN 'due_today'
              WHEN eta = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class
          FROM public.shipping_line_records
          WHERE deleted_at IS NULL AND shipment_status NOT IN ('delivered','completed')
            AND (${smartDueSourceSql(sql, session, "shipping_line")}) AND (${explicitWhere})
        )
        , followups AS (
          SELECT
            CASE
              WHEN status = 'closed' THEN 'completed'
              WHEN due_at IS NULL THEN 'pending'
              WHEN due_at::date < CURRENT_DATE THEN 'overdue'
              WHEN due_at::date = CURRENT_DATE THEN 'due_today'
              WHEN due_at::date = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class
          FROM public.communication_center_followups
          WHERE deleted_at IS NULL AND status != 'closed'
            AND (${smartDueSourceSql(sql, session, "followups")}) AND (${explicitWhere})
        )
        , approvals AS (
          SELECT 'pending' AS urgency_class
          FROM public.approval_requests
          WHERE deleted_at IS NULL AND status = 'pending' AND (${smartDueSourceSql(sql, session, "approvals")}) AND (${explicitWhere})
        )
        , tasks AS (
          SELECT
            CASE
              WHEN status IN ('completed','verified','cancelled') THEN 'completed'
              WHEN due_at IS NULL THEN 'pending'
              WHEN due_at::date < CURRENT_DATE THEN 'overdue'
              WHEN due_at::date = CURRENT_DATE THEN 'due_today'
              WHEN due_at::date = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class
          FROM public.user_tasks
          WHERE deleted_at IS NULL AND status NOT IN ('completed','verified','cancelled')
            AND (${smartDueSourceSql(sql, session, "tasks")}) AND (${explicitWhere})
        )
        , combined AS (
          ${isShipping
            ? sql`SELECT * FROM shipping_bl UNION ALL SELECT * FROM shipping_line
                  UNION ALL SELECT * FROM approvals UNION ALL SELECT * FROM tasks`
            : sql`SELECT * FROM cheques
                  UNION ALL SELECT * FROM purchases
                  UNION ALL SELECT * FROM sales
                  UNION ALL SELECT * FROM shipping_bl
                  UNION ALL SELECT * FROM shipping_line
                  UNION ALL SELECT * FROM followups
                  UNION ALL SELECT * FROM approvals
                  UNION ALL SELECT * FROM tasks`
          }
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE urgency_class = 'overdue')::int AS overdue,
          COUNT(*) FILTER (WHERE urgency_class = 'due_today')::int AS due_today,
          COUNT(*) FILTER (WHERE urgency_class = 'due_tomorrow')::int AS due_tomorrow,
          COUNT(*) FILTER (WHERE urgency_class = 'upcoming')::int AS upcoming,
          COUNT(*) FILTER (WHERE urgency_class = 'pending')::int AS pending
        FROM combined
      `;

      const r = rows[0];
      return {
        total: Number(r?.total || 0),
        overdue: Number(r?.overdue || 0),
        dueToday: Number(r?.due_today || 0),
        dueTomorrow: Number(r?.due_tomorrow || 0),
        upcoming: Number(r?.upcoming || 0),
        pending: Number(r?.pending || 0),
      };
    });

    if (!result) throw new ApiClientError("Database unavailable", { status: 503, code: "DATABASE_UNAVAILABLE" });
    return apiOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
