import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const year = searchParams.get("year") ? Number(searchParams.get("year")) : new Date().getFullYear();
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : new Date().getMonth() + 1;
    let countryId = searchParams.get("countryId");

    // Scope check: Country Admin can only see users of own country
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
    }

    const data = await withLocalPg(async (sql) => {
      // 1. If specific userId requested, return deep breakdown
      if (userId) {
        const userDetails = await sql`
          SELECT id, email, full_name, role, country_id, city_branch_id, created_at, updated_at
          FROM users
          WHERE id::text = ${userId} OR email = ${userId}
          LIMIT 1;
        `;

        const user = userDetails[0];
        if (!user) {
          throw new Error("User not found.");
        }

        // Purchases created by user
        const purchasesCreated = await sql`
          SELECT id, code, total_amount, created_at, status
          FROM purchase_orders
          WHERE created_by::text = ${userId}
          ORDER BY created_at DESC
          LIMIT 50;
        `;

        // Sales created by user
        const salesCreated = await sql`
          SELECT id, code, total_amount, created_at, status
          FROM sales_orders
          WHERE created_by::text = ${userId}
          ORDER BY created_at DESC
          LIMIT 50;
        `;

        // Audit events by user (Edits, Deletes, Restores)
        const auditEvents = await sql`
          SELECT id, entity_type, entity_id, reference_no, action_type, diff_changes, reason, created_at
          FROM enterprise_audit_events
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 50;
        `;

        // Activity counts
        const actionCounts = await sql`
          SELECT 
            COUNT(*) FILTER (WHERE action_type = 'CREATE') AS creates_count,
            COUNT(*) FILTER (WHERE action_type = 'EDIT') AS edits_count,
            COUNT(*) FILTER (WHERE action_type = 'SOFT_DELETE') AS deletes_count,
            COUNT(*) FILTER (WHERE action_type = 'POST') AS posts_count,
            COUNT(*) FILTER (WHERE action_type = 'APPROVE') AS approves_count
          FROM enterprise_audit_events
          WHERE user_id = ${userId}
            AND EXTRACT(YEAR FROM created_at) = ${year}
            AND EXTRACT(MONTH FROM created_at) = ${month};
        `;

        return {
          user,
          year,
          month,
          metrics: actionCounts[0] || {},
          purchases: purchasesCreated,
          sales: salesCreated,
          auditHistory: auditEvents
        };
      }

      // 2. Otherwise return user productivity list
      const usersList = await sql`
        SELECT 
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.country_id,
          c.name AS country_name,
          u.city_branch_id,
          b.name AS branch_name,
          COALESCE((
            SELECT COUNT(*) 
            FROM enterprise_audit_events e 
            WHERE e.user_id = u.id::text AND e.action_type = 'CREATE'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_created,
          COALESCE((
            SELECT COUNT(*) 
            FROM enterprise_audit_events e 
            WHERE e.user_id = u.id::text AND e.action_type = 'EDIT'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_edited,
          COALESCE((
            SELECT COUNT(*) 
            FROM enterprise_audit_events e 
            WHERE e.user_id = u.id::text AND e.action_type = 'SOFT_DELETE'
              AND EXTRACT(YEAR FROM e.created_at) = ${year}
              AND EXTRACT(MONTH FROM e.created_at) = ${month}
          ), 0) AS records_deleted
        FROM users u
        LEFT JOIN countries c ON c.id = u.country_id
        LEFT JOIN city_branches b ON b.id = u.city_branch_id
        WHERE u.deleted_at IS NULL
          ${countryId ? sql`AND u.country_id = ${countryId}` : sql``}
        ORDER BY records_edited DESC, records_created DESC;
      `;

      return {
        year,
        month,
        users: usersList
      };
    });

    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch user activity." }, { status: 500 });
  }
}
