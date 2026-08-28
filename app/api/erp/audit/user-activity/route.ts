import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * User-activity report. There is no `users` table — identity lives in
 * `profiles` (name / code) + `user_role_assignments` (role + Country→Branch
 * scope). Activity is read from `enterprise_audit_events`, which already
 * denormalises `user_id / user_name / user_role / country_id / city_branch_id /
 * action_type` (CREATE | EDIT | SOFT_DELETE | RESTORE), plus the transactions
 * each user booked.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : new Date().getFullYear();
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : new Date().getMonth() + 1;
    let countryId = searchParams.get("countryId");

    // Non-global roles are pinned to their own country.
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (session.countryIds.length > 0) countryId = session.countryIds[0];
    }

    const data = await withLocalPg(async (sql) => {
      const countryFilter = countryId ? sql`AND ura.country_id = ${countryId}` : sql``;

      // ---- 1. Deep breakdown for one user -----------------------------------
      if (userId) {
        const userRows = await sql`
          SELECT
            p.id,
            p.full_name,
            p.user_code,
            p.preferred_language_code,
            p.created_at,
            p.updated_at,
            ura.role,
            ura.country_id,
            ura.city_branch_id,
            c.name  AS country_name,
            b.name  AS branch_name
          FROM public.profiles p
          LEFT JOIN LATERAL (
            SELECT role, country_id, city_branch_id
            FROM public.user_role_assignments
            WHERE user_id = p.id AND (is_active IS TRUE OR is_active IS NULL) AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          ) ura ON TRUE
          LEFT JOIN public.countries c    ON c.id = ura.country_id
          LEFT JOIN public.city_branches b ON b.id = ura.city_branch_id
          WHERE p.id::text = ${userId} AND p.deleted_at IS NULL
          LIMIT 1
        `;
        const user = userRows[0];
        if (!user) throw new Error("User not found.");

        const purchasesCreated = await sql`
          SELECT id, purchase_order_no AS reference, order_total, created_at, payment_status AS status
          FROM public.purchase_orders
          WHERE created_by::text = ${userId} AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 50
        `;
        const salesCreated = await sql`
          SELECT id, sales_order_no AS reference, order_total, created_at, payment_status AS status
          FROM public.sales_orders
          WHERE created_by::text = ${userId} AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 50
        `;
        const auditEvents = await sql`
          SELECT id, entity_type, entity_id, reference_no, action_type, diff_changes, reason, created_at
          FROM public.enterprise_audit_events
          WHERE user_id::text = ${userId}
          ORDER BY created_at DESC
          LIMIT 50
        `;
        const actionCounts = await sql`
          SELECT
            COUNT(*) FILTER (WHERE action_type = 'CREATE')      AS creates_count,
            COUNT(*) FILTER (WHERE action_type = 'EDIT')        AS edits_count,
            COUNT(*) FILTER (WHERE action_type = 'SOFT_DELETE') AS deletes_count,
            COUNT(*) FILTER (WHERE action_type = 'RESTORE')     AS restores_count
          FROM public.enterprise_audit_events
          WHERE user_id::text = ${userId}
            AND EXTRACT(YEAR  FROM created_at) = ${year}
            AND EXTRACT(MONTH FROM created_at) = ${month}
        `;

        return {
          user,
          year,
          month,
          metrics: actionCounts[0] || {},
          purchases: purchasesCreated,
          sales: salesCreated,
          auditHistory: auditEvents,
        };
      }

      // ---- 2. Productivity list for every user -----------------------------
      const usersList = await sql`
        WITH assignees AS (
          SELECT DISTINCT ON (ura.user_id)
            ura.user_id,
            ura.role,
            ura.country_id,
            ura.city_branch_id
          FROM public.user_role_assignments ura
          WHERE (ura.is_active IS TRUE OR ura.is_active IS NULL) AND ura.deleted_at IS NULL
            ${countryFilter}
          ORDER BY ura.user_id, ura.created_at DESC
        )
        SELECT
          p.id,
          p.full_name,
          p.user_code,
          a.role,
          a.country_id,
          c.name AS country_name,
          a.city_branch_id,
          b.name AS branch_name,
          COALESCE((
            SELECT COUNT(*) FROM public.enterprise_audit_events e
            WHERE e.user_id = p.id::text AND e.action_type = 'CREATE'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_created,
          COALESCE((
            SELECT COUNT(*) FROM public.enterprise_audit_events e
            WHERE e.user_id = p.id::text AND e.action_type = 'EDIT'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_edited,
          COALESCE((
            SELECT COUNT(*) FROM public.enterprise_audit_events e
            WHERE e.user_id = p.id::text AND e.action_type = 'SOFT_DELETE'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_deleted
        FROM assignees a
        JOIN public.profiles p       ON p.id = a.user_id AND p.deleted_at IS NULL
        LEFT JOIN public.countries c    ON c.id = a.country_id
        LEFT JOIN public.city_branches b ON b.id = a.city_branch_id
        ORDER BY records_edited DESC, records_created DESC, p.full_name ASC
      `;

      return { year, month, users: usersList };
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch user activity." },
      { status: 500 },
    );
  }
}
