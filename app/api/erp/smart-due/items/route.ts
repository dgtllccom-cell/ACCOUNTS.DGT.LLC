import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type DueItem = {
  sourceType: string;
  sourceId: string;
  dueDate: string | null;
  moduleLabelKey: string;
  referenceNo: string;
  partyName: string;
  countryName: string;
  branchName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  urgencyClass: "overdue" | "due_today" | "due_tomorrow" | "upcoming" | "pending" | "completed";
  responsibleUser: string;
  remarks: string;
  sourceHref: string;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;

    const urgencyFilter = params.get("urgency") || "all";
    const moduleFilter = params.get("module") || "all";
    const countryId = params.get("countryId") || null;
    const countryBranchId = params.get("countryBranchId") || null;
    const cityBranchId = params.get("cityBranchId") || null;
    const lang = params.get("lang") || "en";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize")) || 25));
    const offset = (page - 1) * pageSize;

    // Build scope filter arrays from session
    let scopeCountryIds: string[] = [];
    let scopeCountryBranchIds: string[] = [];
    let scopeCityBranchIds: string[] = [];
    if (!session.isSuperAdmin) {
      scopeCountryIds = [...new Set(session.countryIds)];
      scopeCountryBranchIds = [...new Set(session.countryBranchIds)];
      scopeCityBranchIds = [...new Set(session.cityBranchIds)];
    }

    const isShipping = session.isShippingScoped;

    const result = await withLocalPg(async (sql) => {
      // Scope WHERE fragment reused across all sub-queries
      const scopeWhere = session.isSuperAdmin
        ? sql`true`
        : sql`(
            city_branch_id = ANY(${scopeCityBranchIds}::uuid[])
            OR country_branch_id = ANY(${scopeCountryBranchIds}::uuid[])
            OR country_id = ANY(${scopeCountryIds}::uuid[])
          )`;

      // Explicit scope narrow (from query params)
      const explicitWhere = cityBranchId
        ? sql`city_branch_id = ${cityBranchId}`
        : countryBranchId
          ? sql`country_branch_id = ${countryBranchId}`
          : countryId
            ? sql`country_id = ${countryId}`
            : sql`true`;

      // Resolve translated text helper: maps lang to column name
      const textCol = (alias: string) => {
        const colMap: Record<string, string> = {
          en: `${alias}_en`,
          ur: `${alias}_ur`,
          ar: `${alias}_ar`,
          fa: `${alias}_fa`,
          ps: `${alias}_ps`,
        };
        return colMap[lang] || `${alias}_en`;
      };
      void textCol; // reserved for future per-field resolution

      const langPartyCol =
        lang === "ur" ? "rt_party.urdu_text"
        : lang === "ar" ? "rt_party.arabic_text"
        : lang === "fa" ? "rt_party.persian_text"
        : lang === "ps" ? "rt_party.pashto_text"
        : "rt_party.english_text";
      void langPartyCol;

      const rows = await sql`
        WITH scope_filter AS (SELECT 1)
        , cheques AS (
          SELECT
            'cheque' AS source_type,
            t.id::text AS source_id,
            t.due_date::text AS due_date,
            'smart_due.cheque' AS module_label_key,
            COALESCE(t.cheque_no, t.entry_serial_number) AS reference_no,
            t.bank_name AS party_name,
            COALESCE(c.name, '') AS country_name,
            COALESCE(cb.name, '') AS branch_name,
            (t.debit + t.credit) AS total_amount,
            0::numeric AS paid_amount,
            (t.debit + t.credit) AS remaining_amount,
            t.currency AS currency,
            t.status AS status,
            CASE
              WHEN t.status IN ('cleared','dishonored') THEN 'completed'
              WHEN t.due_date IS NULL THEN 'pending'
              WHEN t.due_date < CURRENT_DATE THEN 'overdue'
              WHEN t.due_date = CURRENT_DATE THEN 'due_today'
              WHEN t.due_date = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class,
            t.user_name AS responsible_user,
            COALESCE(t.particulars, '') AS remarks,
            '/dashboard/roznamcha/reports/bank' AS source_href,
            t.country_id::text AS country_id,
            t.country_branch_id::text AS country_branch_id,
            t.city_branch_id::text AS city_branch_id
          FROM public.bank_cheque_transactions t
          LEFT JOIN public.countries c ON c.id = t.country_id
          LEFT JOIN public.country_branches cb ON cb.id = t.country_branch_id
          WHERE t.deleted_at IS NULL
            AND t.status NOT IN ('cleared','dishonored')
            AND (${scopeWhere})
            AND (${explicitWhere})
        )
        , purchases AS (
          SELECT
            'purchase' AS source_type,
            po.id::text AS source_id,
            NULL::text AS due_date,
            'smart_due.purchase' AS module_label_key,
            po.purchase_order_no AS reference_no,
            COALESCE(comp.name, '') AS party_name,
            COALESCE(c.name, '') AS country_name,
            COALESCE(cb.name, '') AS branch_name,
            po.order_total AS total_amount,
            (po.order_total - po.remaining_due) AS paid_amount,
            po.remaining_due AS remaining_amount,
            po.currency_code AS currency,
            po.payment_status::text AS status,
            CASE
              WHEN po.payment_status::text = 'completed' THEN 'completed'
              WHEN po.payment_status::text = 'cancelled' THEN 'completed'
              ELSE 'pending'
            END AS urgency_class,
            '' AS responsible_user,
            '' AS remarks,
            '/dashboard/purchase/new-purchase-booking-order' AS source_href,
            po.country_id::text AS country_id,
            po.country_branch_id::text AS country_branch_id,
            po.city_branch_id::text AS city_branch_id
          FROM public.purchase_orders po
          LEFT JOIN public.companies comp ON comp.id = po.supplier_company_id
          LEFT JOIN public.countries c ON c.id = po.country_id
          LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
          WHERE po.deleted_at IS NULL
            AND po.payment_status::text NOT IN ('completed','cancelled')
            AND po.remaining_due > 0
            AND (${scopeWhere})
            AND (${explicitWhere})
        )
        , sales AS (
          SELECT
            'sales' AS source_type,
            so.id::text AS source_id,
            NULL::text AS due_date,
            'smart_due.sales' AS module_label_key,
            so.sales_order_no AS reference_no,
            COALESCE(so.customer_name, '') AS party_name,
            COALESCE(c.name, '') AS country_name,
            COALESCE(cb.name, '') AS branch_name,
            so.order_total AS total_amount,
            so.paid_amount AS paid_amount,
            so.remaining_amount AS remaining_amount,
            so.currency_code AS currency,
            so.payment_status AS status,
            CASE
              WHEN so.payment_status IN ('completed','paid') THEN 'completed'
              WHEN so.payment_status = 'cancelled' THEN 'completed'
              ELSE 'pending'
            END AS urgency_class,
            '' AS responsible_user,
            COALESCE(so.product_summary, '') AS remarks,
            '/dashboard/sales/sales-order' AS source_href,
            so.country_id::text AS country_id,
            so.country_branch_id::text AS country_branch_id,
            so.city_branch_id::text AS city_branch_id
          FROM public.sales_orders so
          LEFT JOIN public.countries c ON c.id = so.country_id
          LEFT JOIN public.country_branches cb ON cb.id = so.country_branch_id
          WHERE so.deleted_at IS NULL
            AND so.payment_status NOT IN ('completed','paid','cancelled')
            AND so.remaining_amount > 0
            AND (${scopeWhere})
            AND (${explicitWhere})
        )
        , shipping_bl AS (
          SELECT
            'shipping_bl' AS source_type,
            bl.id::text AS source_id,
            bl.eta::text AS due_date,
            'smart_due.shipping_bl' AS module_label_key,
            bl.bl_number AS reference_no,
            bl.shipping_line_name AS party_name,
            COALESCE(c.name, '') AS country_name,
            COALESCE(cb.name, '') AS branch_name,
            (bl.debit + bl.credit) AS total_amount,
            0::numeric AS paid_amount,
            (bl.debit + bl.credit) AS remaining_amount,
            bl.currency_code AS currency,
            bl.shipment_status AS status,
            CASE
              WHEN bl.shipment_status IN ('delivered','completed') THEN 'completed'
              WHEN bl.eta IS NULL THEN 'pending'
              WHEN bl.eta < CURRENT_DATE THEN 'overdue'
              WHEN bl.eta = CURRENT_DATE THEN 'due_today'
              WHEN bl.eta = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class,
            '' AS responsible_user,
            COALESCE(bl.vessel_name, '') AS remarks,
            '/dashboard/shipping-line/bl-entry' AS source_href,
            bl.country_id::text AS country_id,
            bl.country_branch_id::text AS country_branch_id,
            bl.city_branch_id::text AS city_branch_id
          FROM public.shipping_bl_records bl
          LEFT JOIN public.countries c ON c.id = bl.country_id
          LEFT JOIN public.country_branches cb ON cb.id = bl.country_branch_id
          WHERE bl.deleted_at IS NULL
            AND bl.shipment_status NOT IN ('delivered','completed')
            AND (${scopeWhere})
            AND (${explicitWhere})
        )
        , shipping_line AS (
          SELECT
            'shipping_line' AS source_type,
            sl.id::text AS source_id,
            sl.eta::text AS due_date,
            'smart_due.shipping_line' AS module_label_key,
            COALESCE(sl.shipping_reference_no, sl.shipping_line_name) AS reference_no,
            sl.shipping_line_name AS party_name,
            COALESCE(c.name, '') AS country_name,
            COALESCE(cb.name, '') AS branch_name,
            0::numeric AS total_amount,
            0::numeric AS paid_amount,
            0::numeric AS remaining_amount,
            'USD' AS currency,
            sl.shipment_status AS status,
            CASE
              WHEN sl.shipment_status IN ('delivered','completed') THEN 'completed'
              WHEN sl.eta IS NULL THEN 'pending'
              WHEN sl.eta < CURRENT_DATE THEN 'overdue'
              WHEN sl.eta = CURRENT_DATE THEN 'due_today'
              WHEN sl.eta = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class,
            '' AS responsible_user,
            COALESCE(sl.vessel_name, sl.voyage_number, '') AS remarks,
            '/dashboard/shipping-line/shipment-details' AS source_href,
            sl.country_id::text AS country_id,
            sl.country_branch_id::text AS country_branch_id,
            sl.city_branch_id::text AS city_branch_id
          FROM public.shipping_line_records sl
          LEFT JOIN public.countries c ON c.id = sl.country_id
          LEFT JOIN public.country_branches cb ON cb.id = sl.country_branch_id
          WHERE sl.deleted_at IS NULL
            AND sl.shipment_status NOT IN ('delivered','completed')
            AND (${scopeWhere})
            AND (${explicitWhere})
        )
        , followups AS (
          SELECT
            'followup' AS source_type,
            f.id::text AS source_id,
            f.due_at::date::text AS due_date,
            'smart_due.followup' AS module_label_key,
            COALESCE(f.title, 'Follow-up') AS reference_no,
            '' AS party_name,
            COALESCE(c2.name, '') AS country_name,
            COALESCE(cb2.name, '') AS branch_name,
            0::numeric AS total_amount,
            0::numeric AS paid_amount,
            0::numeric AS remaining_amount,
            'USD' AS currency,
            f.status AS status,
            CASE
              WHEN f.status = 'closed' THEN 'completed'
              WHEN f.due_at IS NULL THEN 'pending'
              WHEN f.due_at::date < CURRENT_DATE THEN 'overdue'
              WHEN f.due_at::date = CURRENT_DATE THEN 'due_today'
              WHEN f.due_at::date = CURRENT_DATE + 1 THEN 'due_tomorrow'
              ELSE 'upcoming'
            END AS urgency_class,
            COALESCE(p2.full_name, '') AS responsible_user,
            COALESCE(f.notes, '') AS remarks,
            '/dashboard/communication-center' AS source_href,
            f.country_id::text AS country_id,
            f.country_branch_id::text AS country_branch_id,
            f.city_branch_id::text AS city_branch_id
          FROM public.communication_center_followups f
          LEFT JOIN public.countries c2 ON c2.id = f.country_id
          LEFT JOIN public.country_branches cb2 ON cb2.id = f.country_branch_id
          LEFT JOIN public.profiles p2 ON p2.id = f.assigned_to
          WHERE f.deleted_at IS NULL AND f.status != 'closed'
            AND (${scopeWhere})
        )
        , combined AS (
          ${isShipping
            ? sql`SELECT * FROM shipping_bl UNION ALL SELECT * FROM shipping_line`
            : sql`SELECT * FROM cheques
                  UNION ALL SELECT * FROM purchases
                  UNION ALL SELECT * FROM sales
                  UNION ALL SELECT * FROM shipping_bl
                  UNION ALL SELECT * FROM shipping_line
                  UNION ALL SELECT * FROM followups`
          }
        )
        SELECT *
        FROM combined
        WHERE
          (${urgencyFilter === "all" ? sql`true` : sql`urgency_class = ${urgencyFilter}`})
          AND (${moduleFilter === "all" ? sql`true` : sql`source_type = ${moduleFilter}`})
        ORDER BY
          CASE urgency_class
            WHEN 'overdue' THEN 1
            WHEN 'due_today' THEN 2
            WHEN 'due_tomorrow' THEN 3
            WHEN 'upcoming' THEN 4
            WHEN 'pending' THEN 5
            ELSE 6
          END,
          due_date ASC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      const countRows = await sql`
        WITH scope_filter AS (SELECT 1)
        , cheques AS (
          SELECT 'cheque' AS source_type, CASE WHEN status IN ('cleared','dishonored') THEN 'completed' WHEN due_date IS NULL THEN 'pending' WHEN due_date < CURRENT_DATE THEN 'overdue' WHEN due_date = CURRENT_DATE THEN 'due_today' WHEN due_date = CURRENT_DATE + 1 THEN 'due_tomorrow' ELSE 'upcoming' END AS urgency_class
          FROM public.bank_cheque_transactions WHERE deleted_at IS NULL AND status NOT IN ('cleared','dishonored') AND (${scopeWhere}) AND (${explicitWhere})
        )
        , purchases AS (
          SELECT 'purchase' AS source_type, 'pending' AS urgency_class
          FROM public.purchase_orders WHERE deleted_at IS NULL AND payment_status::text NOT IN ('completed','cancelled') AND remaining_due > 0 AND (${scopeWhere}) AND (${explicitWhere})
        )
        , sales AS (
          SELECT 'sales' AS source_type, 'pending' AS urgency_class
          FROM public.sales_orders WHERE deleted_at IS NULL AND payment_status NOT IN ('completed','paid','cancelled') AND remaining_amount > 0 AND (${scopeWhere}) AND (${explicitWhere})
        )
        , shipping_bl AS (
          SELECT 'shipping_bl' AS source_type, CASE WHEN shipment_status IN ('delivered','completed') THEN 'completed' WHEN eta IS NULL THEN 'pending' WHEN eta < CURRENT_DATE THEN 'overdue' WHEN eta = CURRENT_DATE THEN 'due_today' WHEN eta = CURRENT_DATE + 1 THEN 'due_tomorrow' ELSE 'upcoming' END AS urgency_class
          FROM public.shipping_bl_records WHERE deleted_at IS NULL AND shipment_status NOT IN ('delivered','completed') AND (${scopeWhere}) AND (${explicitWhere})
        )
        , shipping_line AS (
          SELECT 'shipping_line' AS source_type, CASE WHEN shipment_status IN ('delivered','completed') THEN 'completed' WHEN eta IS NULL THEN 'pending' WHEN eta < CURRENT_DATE THEN 'overdue' WHEN eta = CURRENT_DATE THEN 'due_today' WHEN eta = CURRENT_DATE + 1 THEN 'due_tomorrow' ELSE 'upcoming' END AS urgency_class
          FROM public.shipping_line_records WHERE deleted_at IS NULL AND shipment_status NOT IN ('delivered','completed') AND (${scopeWhere}) AND (${explicitWhere})
        )
        , followups AS (
          SELECT 'followup' AS source_type, CASE WHEN status = 'closed' THEN 'completed' WHEN due_at IS NULL THEN 'pending' WHEN due_at::date < CURRENT_DATE THEN 'overdue' WHEN due_at::date = CURRENT_DATE THEN 'due_today' WHEN due_at::date = CURRENT_DATE + 1 THEN 'due_tomorrow' ELSE 'upcoming' END AS urgency_class
          FROM public.communication_center_followups WHERE deleted_at IS NULL AND status != 'closed' AND (${scopeWhere})
        )
        , combined AS (
          ${isShipping
            ? sql`SELECT * FROM shipping_bl UNION ALL SELECT * FROM shipping_line`
            : sql`SELECT * FROM cheques UNION ALL SELECT * FROM purchases UNION ALL SELECT * FROM sales UNION ALL SELECT * FROM shipping_bl UNION ALL SELECT * FROM shipping_line UNION ALL SELECT * FROM followups`
          }
        )
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE urgency_class = 'overdue')::int AS overdue_count,
          COUNT(*) FILTER (WHERE urgency_class = 'due_today')::int AS due_today_count,
          COUNT(*) FILTER (WHERE urgency_class = 'due_tomorrow')::int AS due_tomorrow_count,
          COUNT(*) FILTER (WHERE urgency_class = 'upcoming')::int AS upcoming_count,
          COUNT(*) FILTER (WHERE urgency_class = 'pending')::int AS pending_count
        FROM combined
        WHERE
          (${urgencyFilter === "all" ? sql`true` : sql`urgency_class = ${urgencyFilter}`})
          AND (${moduleFilter === "all" ? sql`true` : sql`source_type = ${moduleFilter}`})
      `;

      const totals = countRows[0];

      const items: DueItem[] = rows.map((r: Record<string, unknown>) => ({
        sourceType: String(r.source_type),
        sourceId: String(r.source_id),
        dueDate: r.due_date ? String(r.due_date) : null,
        moduleLabelKey: String(r.module_label_key),
        referenceNo: String(r.reference_no || ""),
        partyName: String(r.party_name || ""),
        countryName: String(r.country_name || ""),
        branchName: String(r.branch_name || ""),
        totalAmount: Number(r.total_amount || 0),
        paidAmount: Number(r.paid_amount || 0),
        remainingAmount: Number(r.remaining_amount || 0),
        currency: String(r.currency || "USD"),
        status: String(r.status || ""),
        urgencyClass: String(r.urgency_class) as DueItem["urgencyClass"],
        responsibleUser: String(r.responsible_user || ""),
        remarks: String(r.remarks || ""),
        sourceHref: String(r.source_href || ""),
        countryId: r.country_id ? String(r.country_id) : null,
        countryBranchId: r.country_branch_id ? String(r.country_branch_id) : null,
        cityBranchId: r.city_branch_id ? String(r.city_branch_id) : null,
      }));

      return {
        items,
        total: Number(totals?.total || 0),
        page,
        pageSize,
        counts: {
          overdue: Number(totals?.overdue_count || 0),
          dueToday: Number(totals?.due_today_count || 0),
          dueTomorrow: Number(totals?.due_tomorrow_count || 0),
          upcoming: Number(totals?.upcoming_count || 0),
          pending: Number(totals?.pending_count || 0),
        },
      };
    });

    if (!result) {
      return apiOk({ items: [], total: 0, page, pageSize, counts: { overdue: 0, dueToday: 0, dueTomorrow: 0, upcoming: 0, pending: 0 } });
    }

    return apiOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
