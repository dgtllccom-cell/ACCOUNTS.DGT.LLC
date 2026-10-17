import { withReadPg, withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import { authorizeCustomer360, customerVisibilitySql, crmActionScopeSql, customerModuleScopeSql } from "./customer-360-access";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { canManageInquiries } from "@/lib/customer-inquiry/access";
import { customerCurrencyBalances } from "./customer-360-balances";
import { ApiClientError } from "@/lib/api/response";

export interface Customer360Kpi {
  totalCustomers: number;
  totalCustomersTrend: string;
  activeCustomers: number;
  activeCustomersTrend: string;
  followUpsToday: number;
  followUpsCalls: number;
  followUpsMeetings: number;
  followUpsOthers: number;
  receivableDue: number;
  receivableDueByCurrency: Array<{ currency: string; amount: number }>;
  receivableDueCurrency: string;
  receivableDueTrend: string;
  customerHealth: number;
  customerHealthTrend: string;
}

export interface Customer360Row {
  id: string;
  customerCode: string;
  companyName: string;
  customerName: string;
  avatarInitials: string;
  avatarColor: string;
  countryId: string | null;
  countryName: string;
  countryIso2: string;
  countryFlag: string;
  branchId: string | null;
  branchName: string;
  assignedUserId: string | null;
  assignedUserName: string;
  assignedUserInitials: string;
  lastContact: string;
  nextActionType: string;
  nextActionDate: string;
  health: "Excellent" | "Good" | "Medium" | "Low";
  status: "Active" | "At Risk";
  mobile: string;
  email: string;
  totalReceivable: number;
  currency: string;
}

export interface UpcomingFollowUpRow {
  id: string;
  customerId?: string;
  customerName: string;
  type: string;
  subject: string;
  assignedTo: string;
  assignedToInitials: string;
  dueDate: string;
  dueTime: string;
  status: "Due Now" | "Due Today" | "Upcoming";
  amount?: number;
  currency?: string;
}

export interface Customer360Payload {
  kpis: Customer360Kpi;
  customers: Customer360Row[];
  upcomingFollowUps: UpcomingFollowUpRow[];
  filterOptions: {
    countries: Array<{ id: string; name: string; iso2: string }>;
    branches: Array<{ id: string; name: string; countryId?: string }>;
    users: Array<{ id: string; name: string }>;
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Country flag helper
function getCountryFlag(iso2?: string | null): string {
  if (!iso2) return "🌐";
  const code = iso2.toUpperCase();
  if (code.length !== 2) return "🌐";
  const codePoints = [...code].map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Initials helper
function getInitials(name?: string | null): string {
  if (!name) return "CU";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar color helper
const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-indigo-600 text-white",
  "bg-rose-600 text-white",
  "bg-teal-600 text-white",
  "bg-cyan-600 text-white",
];

function getAvatarColor(name?: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export async function getCustomer360Data(params: {
  session: ErpSession;
  countryId?: string | null;
  branchId?: string | null;
  assignedUser?: string | null;
  searchQuery?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<Customer360Payload> {
  const session = authorizeCustomer360(params.session);
  const result = await withReadPg(async (sql) => {
    const page = Math.max(1, Math.trunc(params.page || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize || 10)));
    const offset = (page - 1) * pageSize;

    const scope = sessionSqlScope(session);
    const masterScope = customerVisibilitySql(sql, session);
    const actionScope = crmActionScopeSql(sql, session);
    const customerFilters = sql`
      ${params.startDate ? sql`AND c.created_at >= ${params.startDate}::date` : sql``}
      ${params.endDate ? sql`AND c.created_at < (${params.endDate}::date + interval '1 day')` : sql``}
      ${params.assignedUser && params.assignedUser !== "all" ? sql`AND EXISTS (
        SELECT 1 FROM public.crm_action_items a WHERE a.source_type = 'customer' AND a.source_id = c.id::text
          AND a.is_completed = false AND ${actionScope}
          AND (a.responsible_user_id = ${params.assignedUser} OR a.responsible_user_name = ${params.assignedUser})
      )` : sql``}`;


    // 1. Fetch available filter options
    const branchRows = await sql`
      SELECT cb.id, cb.name, cb.country_id FROM public.city_branches cb
      WHERE cb.deleted_at IS NULL AND (cb.status IS NULL OR cb.status = 'active')
        AND ${scope.kind === "all" ? sql`TRUE` : scope.kind === "country" ? sql`cb.country_id = ANY(${scope.ids}::uuid[])` : scope.kind === "cityBranch" ? sql`cb.id = ANY(${scope.ids}::uuid[])` : scope.kind === "countryBranch" ? sql`cb.country_branch_id = ANY(${scope.ids}::uuid[])` : sql`FALSE`}
      ORDER BY cb.name`;
    const countryRows = await sql`
      SELECT co.id, co.name, co.iso2 FROM public.countries co
      WHERE co.is_active = true AND co.deleted_at IS NULL
        AND ${scope.kind === "all" ? sql`TRUE` : sql`co.id = ANY(${session.countryIds}::uuid[])`}
      ORDER BY co.name`;

    // 2. Aggregate KPIs
    const kpiSummary = await sql`
      SELECT
        COUNT(*) AS total_cust,
        COUNT(*) FILTER (WHERE is_active = true) AS active_cust
      FROM public.customers c
      WHERE c.deleted_at IS NULL AND ${masterScope} ${customerFilters}
        ${params.countryId && params.countryId !== "all" ? sql`AND country_id = ${params.countryId}::uuid` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL AND ea.city_branch_id = ${params.branchId}::uuid AND ${sqlScopeCondition(sql, scope, "ea")})` : sql``}
    `;

    const followUpKpi = await sql`
      SELECT
        COUNT(*) AS today_total,
        COUNT(*) FILTER (WHERE item_type ILIKE '%call%') AS calls_cnt,
        COUNT(*) FILTER (WHERE item_type ILIKE '%meet%') AS meet_cnt,
        COUNT(*) FILTER (WHERE item_type NOT ILIKE '%call%' AND item_type NOT ILIKE '%meet%') AS other_cnt,
        COUNT(*) FILTER (WHERE item_type = 'Sales Recovery') AS recovery_count
      FROM public.crm_action_items a
      WHERE is_completed = false AND ${actionScope} AND due_date = CURRENT_DATE
        ${params.countryId && params.countryId !== "all" ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND city_branch_id = ${params.branchId}` : sql``}
    `;

    const totalCust = Number(kpiSummary[0]?.total_cust || 0);
    const activeCust = Number(kpiSummary[0]?.active_cust || 0);
    const todayFollowUps = Number(followUpKpi[0]?.today_total || 0);
    const callsCnt = Number(followUpKpi[0]?.calls_cnt || 0);
    const meetCnt = Number(followUpKpi[0]?.meet_cnt || 0);
    const otherCnt = Number(followUpKpi[0]?.other_cnt || 0);
    const receivableRows = await sql`
      SELECT currency, SUM(remaining_amount) AS amount FROM public.crm_action_items a
      WHERE is_completed = false AND item_type = 'Sales Recovery' AND remaining_amount > 0
        AND ${actionScope}
        ${params.countryId && params.countryId !== "all" ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND city_branch_id = ${params.branchId}` : sql``}
      GROUP BY currency ORDER BY currency`;
    const receivableDueByCurrency = receivableRows.map((r: any) => ({ currency: r.currency, amount: Number(r.amount) }));
    const recDue = receivableDueByCurrency.length === 1 ? receivableDueByCurrency[0].amount : 0;

    // Customer health: ratio of active accounts
    const healthPercent = totalCust > 0 ? Math.min(100, Math.round((activeCust / totalCust) * 100)) : (activeCust > 0 ? 100 : 0);

    const kpis: Customer360Kpi = {
      totalCustomers: totalCust,
      totalCustomersTrend: totalCust > 0 ? `${totalCust} registered` : "0 registered",
      activeCustomers: activeCust,
      activeCustomersTrend: totalCust > 0 ? `${Math.round((activeCust / totalCust) * 100)}% active` : "0% active",
      followUpsToday: todayFollowUps,
      followUpsCalls: callsCnt,
      followUpsMeetings: meetCnt,
      followUpsOthers: otherCnt,
      receivableDue: recDue,
      receivableDueByCurrency,
      receivableDueCurrency: receivableDueByCurrency.length === 1 ? receivableDueByCurrency[0].currency : "—",
      receivableDueTrend: receivableDueByCurrency.length > 0 ? "Pending collection" : "Zero pending balance",
      customerHealth: healthPercent,
      customerHealthTrend: totalCust > 0 ? `${activeCust}/${totalCust} active accounts` : "No accounts"
    };

    // 3. Query Customers Register Table
    const searchLike = params.searchQuery ? `%${params.searchQuery.trim()}%` : null;

    const customersQuery = await sql`
      SELECT 
        c.id,
        c.person_code,
        c.customer_name,
        c.company_name,
        c.mobile,
        c.email,
        c.is_active,
        c.created_at,
        c.updated_at,
        co.id AS country_id,
        co.name AS country_name,
        co.iso2 AS country_iso2,
        cb.id AS branch_id,
        cb.name AS branch_name,
        latest_action.item_type AS next_action_type,
        latest_action.due_date AS next_action_date,
        latest_action.status AS next_action_status,
        latest_action.responsible_user_name AS action_user,
        latest_action.last_follow_up,
        latest_action.urgency_class
      FROM public.customers c
      LEFT JOIN public.countries co ON co.id = c.country_id
      LEFT JOIN LATERAL (
        SELECT b.id, b.name FROM public.enterprise_accounts ea JOIN public.city_branches b ON b.id = ea.city_branch_id
        WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "ea")}
        ORDER BY ea.created_at, ea.id LIMIT 1
      ) cb ON true
      LEFT JOIN LATERAL (
        SELECT 
          item_type, 
          due_date, 
          status, 
          responsible_user_name, 
          last_follow_up, 
          urgency_class
        FROM public.crm_action_items a
        WHERE a.source_type = 'customer' AND a.source_id = c.id::text AND a.is_completed = false AND ${actionScope}
        ORDER BY a.due_date ASC
        LIMIT 1
      ) latest_action ON true
      WHERE c.deleted_at IS NULL AND ${masterScope} ${customerFilters}
        ${params.countryId && params.countryId !== "all" ? sql`AND c.country_id = ${params.countryId}::uuid` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL AND ea.city_branch_id = ${params.branchId}::uuid AND ${sqlScopeCondition(sql, scope, "ea")})` : sql``}
        ${params.status === "active" ? sql`AND c.is_active = true` : params.status === "at_risk" ? sql`AND c.is_active = false` : sql``}
        ${searchLike ? sql`AND (
          c.customer_name ILIKE ${searchLike}
          OR c.company_name ILIKE ${searchLike}
          OR c.person_code ILIKE ${searchLike}
          OR c.mobile ILIKE ${searchLike}
          OR c.email ILIKE ${searchLike}
        )` : sql``}
      ORDER BY c.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    const countResult = await sql`
      SELECT COUNT(*) AS total
      FROM public.customers c
      WHERE c.deleted_at IS NULL AND ${masterScope} ${customerFilters}
        ${params.countryId && params.countryId !== "all" ? sql`AND c.country_id = ${params.countryId}::uuid` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL AND ea.city_branch_id = ${params.branchId}::uuid AND ${sqlScopeCondition(sql, scope, "ea")})` : sql``}
        ${params.status === "active" ? sql`AND c.is_active = true` : params.status === "at_risk" ? sql`AND c.is_active = false` : sql``}
        ${searchLike ? sql`AND (
          c.customer_name ILIKE ${searchLike}
          OR c.company_name ILIKE ${searchLike}
          OR c.person_code ILIKE ${searchLike}
          OR c.mobile ILIKE ${searchLike}
          OR c.email ILIKE ${searchLike}
        )` : sql``};
    `;

    const totalRecords = Number(countResult[0]?.total || 0);

    // Format customer rows
    const customerList: Customer360Row[] = customersQuery.map((r: any, idx: number) => {
      const company = r.company_name || r.customer_name || "Company";
      const code = r.person_code || `CUST-${String(idx + 1).padStart(4, "0")}`;
      const initials = getInitials(company);
      const color = getAvatarColor(company);
      const flag = getCountryFlag(r.country_iso2);
      
      // Calculate health & status
      let health: "Excellent" | "Good" | "Medium" | "Low" = "Good";
      let status: "Active" | "At Risk" = r.is_active ? "Active" : "At Risk";

      if (r.urgency_class === "overdue") {
        health = "Low";
        status = "At Risk";
      } else if (r.urgency_class === "due_today") {
        health = "Medium";
      } else if (r.is_active) {
        health = "Good";
      }

      // Next action label
      const nextType = r.next_action_type || "-";
      const nextDate = r.next_action_date 
        ? new Date(r.next_action_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "-";

      const lastContactDate = r.last_follow_up || r.updated_at || r.created_at;
      const formattedLastContact = lastContactDate 
        ? new Date(lastContactDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "-";

      const assignedUser = r.action_user || "-";

      return {
        id: r.id,
        customerCode: code,
        companyName: company,
        customerName: r.customer_name || company,
        avatarInitials: initials,
        avatarColor: color,
        countryId: r.country_id,
        countryName: r.country_name || "—",
        countryIso2: r.country_iso2 || "",
        countryFlag: flag,
        branchId: r.branch_id,
        branchName: r.branch_name || "Main Branch",
        assignedUserId: null,
        assignedUserName: assignedUser,
        assignedUserInitials: getInitials(assignedUser),
        lastContact: formattedLastContact,
        nextActionType: nextType,
        nextActionDate: nextDate,
        health,
        status,
        mobile: r.mobile || "-",
        email: r.email || "-",
        totalReceivable: 0,
        currency: "AED"
      };
    });

    // 4. Upcoming Follow-Ups (Bottom Left Widget)
    const upcomingFollowUpsQuery = await sql`
      SELECT 
        id, 
        party_name, 
        item_type, 
        reference_no, 
        notes, 
        due_date, 
        urgency_class, 
        responsible_user_name,
        remaining_amount,
        currency
      FROM public.crm_action_items a
      WHERE is_completed = false AND ${actionScope}
        ${params.countryId && params.countryId !== "all" ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.branchId && params.branchId !== "all" ? sql`AND city_branch_id = ${params.branchId}` : sql``}
      ORDER BY due_date ASC
      LIMIT 10;
    `;

    const upcomingFollowUps: UpcomingFollowUpRow[] = upcomingFollowUpsQuery.map((r: any) => {
      let st: "Due Now" | "Due Today" | "Upcoming" = "Upcoming";
      if (r.urgency_class === "overdue") st = "Due Now";
      else if (r.urgency_class === "due_today") st = "Due Today";

      const dueObj = r.due_date ? new Date(r.due_date) : new Date();
      const datePart = dueObj.toISOString().slice(0, 10);
      const isToday = datePart === new Date().toISOString().slice(0, 10);
      const formattedDate = isToday ? "Today" : dueObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = "";

      const assigned = r.responsible_user_name || "Sales Rep";

      return {
        id: r.id,
        customerName: r.party_name || "Customer",
        type: r.item_type || "Follow Up",
        subject: r.notes || r.reference_no || "Follow-up conversation",
        assignedTo: assigned,
        assignedToInitials: getInitials(assigned),
        dueDate: formattedDate,
        dueTime: timeStr,
        status: st,
        amount: Number(r.remaining_amount || 0),
        currency: r.currency || "AED"
      };
    });

    // Extract unique users for filters
    const usersSet = new Map<string, string>();
    customerList.forEach(c => {
      if (c.assignedUserName) usersSet.set(c.assignedUserName, c.assignedUserName);
    });

    return {
      kpis,
      customers: customerList,
      upcomingFollowUps,
      filterOptions: {
        countries: countryRows.map((c: any) => ({ id: c.id, name: c.name, iso2: c.iso2 })),
        branches: branchRows.map((b: any) => ({ id: b.id, name: b.name, countryId: b.country_id })),
        users: Array.from(usersSet.values()).map(u => ({ id: u, name: u }))
      },
      pagination: {
        total: totalRecords,
        page,
        pageSize,
        totalPages: Math.ceil(totalRecords / pageSize) || 1
      }
    };
  });
  if (!result) throw new ApiClientError("Database unavailable", { status: 503, code: "DATABASE_UNAVAILABLE" });
  return result;
}

/**
 * Customer 360 Full Profile Loader
 * Gathers complete 360-degree data across all ERP modules:
 * Customer details, Sales, Purchases, Cheques, Shipping, Clearing, and Timeline
 */
export async function getCustomer360Profile(params: {
  session: ErpSession;
  customerId: string;
}) {
  const session = authorizeCustomer360(params.session);
  const result = await withReadPg(async (sql) => {
    // 1. Fetch customer details
    const custRows = await sql`
      SELECT 
        c.*,
        co.name AS country_name,
        co.iso2 AS country_iso2,
        cb.name AS branch_name,
        ci.name AS city_name
      FROM public.customers c
      LEFT JOIN public.countries co ON co.id = c.country_id
      LEFT JOIN LATERAL (
        SELECT b.name FROM public.enterprise_accounts ea JOIN public.city_branches b ON b.id = ea.city_branch_id
        WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL AND ${sqlScopeCondition(sql, sessionSqlScope(session), "ea")}
        ORDER BY ea.created_at, ea.id LIMIT 1
      ) cb ON true
      LEFT JOIN public.cities ci ON ci.id = c.city_id
      WHERE c.id = ${params.customerId}::uuid AND c.deleted_at IS NULL AND ${customerVisibilitySql(sql, session)}
      LIMIT 1;
    `;

    const customer = custRows[0];
    if (!customer) {
      throw new ApiClientError("Customer not found.", { status: 404, code: "NOT_FOUND" });
    }

    // 2. Fetch real Sales Orders for this customer
    const salesOrders = await sql`
      SELECT 
        id, 
        sales_order_no, 
        sales_contract_no, 
        order_date, 
        order_total, 
        paid_amount, 
        remaining_amount, 
        currency_code, 
        sales_status, 
        payment_status,
        product_summary
      FROM public.sales_orders so
      WHERE deleted_at IS NULL AND ${customerModuleScopeSql(sql, session, "sales", "so")}
        AND (
          EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.id = so.customer_account_id
            AND ea.customer_id = ${params.customerId}::uuid AND ea.deleted_at IS NULL)
        )
      ORDER BY order_date DESC;
    `;

    // 3. Fetch real Purchase Orders if party acts as supplier / vendor
    const purchaseOrders = await sql`
      SELECT 
        id, 
        purchase_order_no, 
        purchase_contract_no, 
        order_total, 
        advance_paid, 
        remaining_due, 
        currency_code, 
        payment_status,
        status,
        created_at
      FROM public.purchase_orders po
      WHERE deleted_at IS NULL AND ${customerModuleScopeSql(sql, session, "purchases", "po")}
        AND (
          EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.customer_id = ${params.customerId}::uuid
            AND ea.deleted_at IS NULL AND ea.id::text = po.form_data->'form'->>'purchaseAccountId')
        )
      ORDER BY created_at DESC;
    `;

    // 4. Fetch Cheques & Recovery transactions
    const cheques = await sql`
      SELECT 
        id, 
        cheque_no, 
        bank_name, 
        particulars, 
        cheque_date, 
        due_date, 
        debit, 
        credit, 
        currency, 
        status
      FROM public.bank_cheque_transactions ch
      WHERE deleted_at IS NULL AND ${customerModuleScopeSql(sql, session, "roznamcha", "ch")}
        AND (
          EXISTS (SELECT 1 FROM public.ledgers l JOIN public.enterprise_accounts ea ON ea.id = l.enterprise_account_id
            WHERE l.id IN (ch.ledger_id, ch.counter_ledger_id) AND l.deleted_at IS NULL
              AND ea.deleted_at IS NULL AND ea.customer_id = ${params.customerId}::uuid)
        )
      ORDER BY due_date DESC
      LIMIT 20;
    `;

    // 5. Fetch Clearing & Shipping records
    const clearingOrders = await sql`
      SELECT 
        id, 
        order_no, 
        customer_name, 
        cargo_details, 
        route_name, 
        shipment_type, 
        status, 
        expected_loading_date,
        created_at
      FROM public.clearing_customer_orders cl
      WHERE deleted_at IS NULL AND ${customerModuleScopeSql(sql, session, "shipping_records", "cl")}
        AND (
          customer_id = ${params.customerId}::uuid
        )
      ORDER BY created_at DESC
      LIMIT 20;
    `;

    const shippingRecords = await sql`
      SELECT 
        id, 
        shipping_reference_no, 
        shipping_line_name, 
        vessel_name, 
        voyage_number, 
        container_numbers, 
        port_of_loading, 
        port_of_discharge, 
        shipment_status,
        eta, 
        etd
      FROM public.shipping_line_records sh
      WHERE deleted_at IS NULL AND ${customerModuleScopeSql(sql, session, "shipping", "sh")}
        AND (
          EXISTS (SELECT 1 FROM public.enterprise_accounts ea WHERE ea.id = sh.account_id
            AND ea.customer_id = ${params.customerId}::uuid AND ea.deleted_at IS NULL)
        )
      ORDER BY created_at DESC
      LIMIT 20;
    `;

    // Reuse existing inquiry and communication records; never create a second CRM history.
    const inquiries = await sql`
      SELECT i.id, i.inquiry_no, i.inquiry_summary, i.status, i.source, i.created_at, i.follow_up_date
      FROM public.customer_inquiries i
      WHERE i.customer_id = ${params.customerId}::uuid AND i.deleted_at IS NULL
        AND ${sqlScopeCondition(sql, sessionSqlScope(session), "i")}
        AND ${canManageInquiries(session) ? sql`TRUE` : sql`(i.created_by = ${session.userId}::uuid OR i.assigned_to = ${session.userId}::uuid)`}
      ORDER BY i.created_at DESC LIMIT 30`;
    const communications = await sql`
      SELECT m.id, m.channel, m.subject, m.body, m.sender_name, m.created_at, m.linked_route
      FROM public.communication_center_messages m
      WHERE m.customer_id = ${params.customerId}::uuid AND m.deleted_at IS NULL
        AND ${customerModuleScopeSql(sql, session, "messages", "m")}
      ORDER BY m.created_at DESC LIMIT 30`;

    // 6. Fetch Activity Timeline (Follow-up notes and action items)
    const timelineNotes = await sql`
      SELECT 
        n.id,
        n.note_type,
        n.note_text,
        n.user_name,
        n.user_role,
        n.promise_date,
        n.promise_amount,
        n.created_at
      FROM public.crm_followup_notes n
      JOIN public.crm_action_items a ON a.id = n.crm_item_id
      WHERE a.source_type = 'customer' AND a.source_id = ${params.customerId}
        AND ${crmActionScopeSql(sql, session)}
      ORDER BY n.created_at DESC
      LIMIT 30;
    `;

    const actionItems = await sql`
      SELECT 
        id,
        source_type,
        reference_no,
        item_type,
        module,
        amount,
        paid_amount,
        remaining_amount,
        currency,
        urgency_class,
        status,
        notes,
        due_date,
        is_completed,
        created_at
      FROM public.crm_action_items a
      WHERE a.source_type = 'customer' AND a.source_id = ${params.customerId}
        AND ${crmActionScopeSql(sql, session)}
      ORDER BY created_at DESC
      LIMIT 30;
    `;

    // 7. Calculate Financial Totals
    const balancesByCurrency = customerCurrencyBalances(salesOrders, purchaseOrders);
    // Scalar compatibility fields are valid only when every balance has the same currency.
    const singleBalance = balancesByCurrency.length === 1 ? balancesByCurrency[0] : null;

    return {
      customer: {
        id: customer.id,
        customerCode: customer.person_code || `CUST-${customer.id.slice(0, 6).toUpperCase()}`,
        customerName: customer.customer_name,
        companyName: customer.company_name || customer.customer_name,
        contactPerson: customer.contact_person || customer.customer_name,
        mobile: customer.mobile || "-",
        whatsapp: customer.whatsapp || customer.mobile || "-",
        email: customer.email || "-",
        address: customer.address || "-",
        notes: customer.notes || "-",
        countryName: customer.country_name || "—",
        countryIso2: customer.country_iso2 || "",
        branchName: customer.branch_name || "Main Branch",
        cityName: customer.city_name || "-",
        isActive: customer.is_active,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at
      },
      financialSummary: {
        totalReceivable: singleBalance?.totalReceivable ?? null,
        totalPayable: singleBalance?.totalPayable ?? null,
        netPosition: singleBalance?.netPosition ?? null,
        currency: singleBalance?.currency ?? null,
        balancesByCurrency,
        salesOrdersCount: salesOrders.length,
        purchaseOrdersCount: purchaseOrders.length,
        chequesCount: cheques.length
      },
      salesOrders: salesOrders.map((so: any) => ({
        id: so.id,
        salesOrderNo: so.sales_order_no,
        salesContractNo: so.sales_contract_no,
        orderDate: so.order_date ? new Date(so.order_date).toISOString().slice(0, 10) : "-",
        orderTotal: Number(so.order_total || 0),
        paidAmount: Number(so.paid_amount || 0),
        remainingAmount: Number(so.remaining_amount || 0),
        currency: so.currency_code || "AED",
        salesStatus: so.sales_status || "Active",
        paymentStatus: so.payment_status || "Pending",
        link: `/dashboard/sales/sales-order?orderId=${so.id}`
      })),
      purchaseOrders: purchaseOrders.map((po: any) => ({
        id: po.id,
        purchaseOrderNo: po.purchase_order_no,
        contractNo: po.purchase_contract_no,
        orderDate: po.created_at ? new Date(po.created_at).toISOString().slice(0, 10) : "-",
        orderTotal: Number(po.order_total || 0),
        advancePaid: Number(po.advance_paid || 0),
        remainingDue: Number(po.remaining_due || 0),
        currency: po.currency_code || "USD",
        paymentStatus: po.payment_status || "Pending",
        link: `/dashboard/purchase/new-purchase-booking-order?orderId=${po.id}`
      })),
      cheques: cheques.map((ch: any) => ({
        id: ch.id,
        chequeNo: ch.cheque_no,
        bankName: ch.bank_name,
        particulars: ch.particulars,
        dueDate: ch.due_date ? new Date(ch.due_date).toISOString().slice(0, 10) : "-",
        debit: Number(ch.debit || 0),
        credit: Number(ch.credit || 0),
        currency: ch.currency || "PKR",
        status: ch.status || "Pending",
        link: `/dashboard/roznamcha/cash-entry`
      })),
      shippingAndClearing: [
        ...clearingOrders.map((cl: any) => ({
          type: "Clearing",
          id: cl.id,
          referenceNo: cl.order_no,
          details: cl.cargo_details || cl.route_name || "Customs Clearance",
          status: cl.status || "In Transit",
          date: cl.expected_loading_date ? new Date(cl.expected_loading_date).toISOString().slice(0, 10) : "-",
          link: `/dashboard/clearing-agent/customer-order?orderId=${cl.id}`
        })),
        ...shippingRecords.map((sh: any) => ({
          type: "Shipping BL",
          id: sh.id,
          referenceNo: sh.shipping_reference_no,
          details: `${sh.shipping_line_name || "Line"} • ${sh.container_numbers || "Containers"}`,
          status: sh.shipment_status || "Dispatched",
          date: sh.eta ? new Date(sh.eta).toISOString().slice(0, 10) : "-",
          link: `/dashboard/shipping-line/shipment-details?id=${sh.id}`
        }))
      ],
      timeline: [
        ...inquiries.map((i: any) => ({
          id: i.id, type: i.source, content: [i.inquiry_no, i.inquiry_summary, i.status].filter(Boolean).join(" · "),
          author: customer.customer_name, role: "", date: new Date(i.created_at).toISOString(),
          promiseDate: i.follow_up_date ? new Date(i.follow_up_date).toISOString().slice(0, 10) : null,
          promiseAmount: null, link: `/dashboard/customer-inquiries?id=${i.id}`,
        })),
        ...communications.map((m: any) => ({
          id: m.id, type: m.channel, content: [m.subject, m.body].filter(Boolean).join("\n"),
          author: m.sender_name || "—", role: "", date: new Date(m.created_at).toISOString(),
          promiseDate: null, promiseAmount: null,
          link: typeof m.linked_route === "string" && m.linked_route.startsWith("/dashboard/") ? m.linked_route : "/dashboard/communication",
        })),
        ...timelineNotes.map((n: any) => ({
          id: n.id,
          type: n.note_type || "Note",
          content: n.note_text,
          author: n.user_name || "Representative",
          role: n.user_role || "User",
          date: new Date(n.created_at).toISOString(),
          promiseDate: n.promise_date ? new Date(n.promise_date).toISOString().slice(0, 10) : null,
          promiseAmount: n.promise_amount ? Number(n.promise_amount) : null
        })),
        ...actionItems.map((a: any) => ({
          id: a.id,
          type: a.item_type || "Action Item",
          content: `${a.module || "CRM"}: ${a.notes || a.reference_no} (${a.amount} ${a.currency})`,
          author: "System Engine",
          role: "Automated",
          date: new Date(a.created_at).toISOString(),
          promiseDate: a.due_date ? new Date(a.due_date).toISOString().slice(0, 10) : null,
          promiseAmount: null
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  });
  if (!result) throw new ApiClientError("Database unavailable", { status: 503, code: "DATABASE_UNAVAILABLE" });
  return result;
}

/**
 * Log a new Interaction / Follow-up directly from Customer 360
 */
export async function logCustomer360Activity(params: {
  session: ErpSession;
  customerId: string;
  activityType: "Call" | "Meeting" | "Message" | "Note";
  subject?: string;
  notes: string;
  promiseDate?: string | null;
  promiseAmount?: number | null;
}) {
  const session = authorizeCustomer360(params.session, "update");
  const result = await withLocalPg(async (pool) => pool.begin(async (sql) => {
    const [cust] = await sql`
      SELECT c.id, c.customer_name, c.company_name, c.country_id, co.currency_code,
        account_scope.country_branch_id, account_scope.city_branch_id
      FROM public.customers c
      LEFT JOIN public.countries co ON co.id = c.country_id
      LEFT JOIN LATERAL (
        SELECT ea.country_branch_id, ea.city_branch_id FROM public.enterprise_accounts ea
        WHERE ea.customer_id = c.id AND ea.deleted_at IS NULL
          AND ${sqlScopeCondition(sql, sessionSqlScope(session), "ea")}
        ORDER BY ea.created_at, ea.id LIMIT 1
      ) account_scope ON true
      WHERE c.id = ${params.customerId}::uuid AND c.deleted_at IS NULL
        AND ${customerVisibilitySql(sql, session)}
      LIMIT 1`;
    if (!cust) throw new ApiClientError("Customer not found.", { status: 404, code: "NOT_FOUND" });

    // Serialize activity writes per customer. Never reuse another customer's same-name item.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${cust.id}::text, 0))`;
    const existingItems = await sql`
      SELECT a.id FROM public.crm_action_items a
      WHERE a.source_type = 'customer' AND a.source_id = ${cust.id}::text
        AND a.is_completed = false AND ${crmActionScopeSql(sql, session)}
        AND a.country_id IS NOT DISTINCT FROM ${cust.country_id}::text
        AND a.country_branch_id IS NOT DISTINCT FROM ${cust.country_branch_id}::text
        AND a.city_branch_id IS NOT DISTINCT FROM ${cust.city_branch_id}::text
      ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE`;
    let crmItemId = existingItems[0]?.id;
    const actorId = session.userId;
    const actorName = session.fullName || session.userId;
    const actorRole = session.roles[0] || "user";
    if (!crmItemId) {
      const [item] = await sql`
        INSERT INTO public.crm_action_items (
          source_type, source_id, reference_no, party_name, due_date,
          item_type, module, amount, paid_amount, remaining_amount, currency,
          country_id, country_branch_id, city_branch_id, responsible_user_id, responsible_user_name,
          urgency_class, status, notes
        ) VALUES (
          'customer', ${cust.id}, ${`CRM-${cust.id}`}, ${cust.company_name || cust.customer_name},
          COALESCE(${params.promiseDate ?? null}::date, CURRENT_DATE),
          ${params.activityType}, 'CRM', 0, 0, 0, ${cust.currency_code || 'USD'},
          ${cust.country_id}, ${cust.country_branch_id}, ${cust.city_branch_id}, ${actorId}, ${actorName},
          'due_today', 'In Progress', ${params.notes}
        ) RETURNING id`;
      crmItemId = item.id;
    }
    const [note] = await sql`
      INSERT INTO public.crm_followup_notes (
        crm_item_id, user_id, user_name, user_role, note_type, note_text, promise_date, promise_amount
      ) VALUES (
        ${crmItemId}, ${actorId}, ${actorName}, ${actorRole}, ${params.activityType}, ${params.notes},
        ${params.promiseDate ?? null}::date, ${params.promiseAmount ?? null}
      ) RETURNING id`;
    await sql`
      UPDATE public.crm_action_items SET last_follow_up = NOW(),
        next_follow_up = COALESCE(${params.promiseDate ?? null}::date, next_follow_up),
        status = 'In Progress', notes = ${params.notes}, updated_at = NOW()
      WHERE id = ${crmItemId}`;
    return { success: true, noteId: note.id };
  }));
  if (!result) throw new ApiClientError("Database unavailable", { status: 503, code: "DATABASE_UNAVAILABLE" });
  return result;
}
