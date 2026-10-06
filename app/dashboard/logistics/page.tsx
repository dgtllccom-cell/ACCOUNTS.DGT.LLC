import { LogisticsDashboardOverview, type LogisticsDashboardData } from "@/features/dashboard/components/logistics-dashboard-overview";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentErpSession } from "@/lib/auth/session";
import { enforceScopeFilter } from "@/lib/api/scope-middleware";
import { isGlobalSession } from "@/lib/permissions/middleware";
import { hasRolePermission } from "@/lib/permissions/middleware";

export const metadata = { title: "Logistics Tracking Dashboard" };

type QueryBuilder = any;
type QueryResult<T> = {
  data?: T | null;
  count?: number | null;
  error?: { message?: string } | null;
};

const emptyData: LogisticsDashboardData = {
  assignedShipments: 0,
  pendingClearance: 0,
  inTransit: 0,
  trackedContainers: 0,
  documents: 0,
  delivered: 0,
  completedShipments: 0,
  pendingTasks: 0,
  notifications: 0,
  shipments: [],
  tasks: [],
  databaseReady: true,
  error: null,
};

function withTimeout<T>(promise: PromiseLike<T>, fallback: T, ms = 3500): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);

    Promise.resolve(promise)
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

async function safeCount(table: string, build?: (query: QueryBuilder) => QueryBuilder): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    let query: QueryBuilder = (supabase as any).from(table).select("id", { count: "exact", head: true });
    if (build) query = build(query);
    const { count, error } = await withTimeout<QueryResult<unknown>>(query, {
      count: 0,
      error: { message: "Logistics count query timed out." },
    });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function loadLogisticsDashboardData(session: any): Promise<LogisticsDashboardData> {
  try {
    const supabase = createSupabaseAdminClient();
    const clearingAgentIds: string[] = session?.clearingAgentIds || [];
    // Every KPI below goes through the SAME scope helpers the APIs use. They fail CLOSED: a login with no scope sees nothing
    // (the previous hand-written filters applied no filter at all when the session carried no ids).
    const applyShipmentScope = (query: any) => {
      let q = enforceScopeFilter(query.is("deleted_at", null), session);
      // a Shipping Line login sees only the shipping line(s) it is bound to
      if (!session?.isSuperAdmin && session?.shippingLineIds?.length > 0) q = q.in("shipping_line_id", session.shippingLineIds);
      return q;
    };

    const applyClearingScope = (query: any) => {
      let q = query.is("deleted_at", null);
      if (isGlobalSession(session)) return q;
      // assigned-only logins: legs of THEIR shipping line / THEIR clearing agent / assigned to them — never the whole branch
      if (session?.shippingLineIds?.length > 0) q = q.in("shipping_line_id", session.shippingLineIds);
      if (session?.isShippingScoped && clearingAgentIds.length > 0) {
        return q.or(`responsible_clearing_agent_id.in.(${clearingAgentIds.join(",")}),customs_clearing_agent_id.in.(${clearingAgentIds.join(",")}),responsible_user_id.eq.${session.userId}`);
      }
      if (session?.cityBranchIds?.length > 0) return q.in("responsible_city_branch_id", session.cityBranchIds);
      if (session?.countryBranchIds?.length > 0) return q.in("responsible_country_branch_id", session.countryBranchIds);
      if (session?.countryIds?.length > 0) return q.in("customs_country_id", session.countryIds);
      return q.eq("id", "00000000-0000-0000-0000-000000000000");
    };

    // Tasks: an agent / shipping-line user / restricted user sees the tasks assigned to THEM (or to their clearing agent);
    // an admin sees the tasks of their scope.
    const assignedOnly = !isGlobalSession(session) && (session?.roles ?? []).length > 0 &&
      (session.roles as string[]).every((r) => ["agent_user", "shipping_line_user", "shipping_line_admin", "staff_user"].includes(r));
    const applyTaskScope = (query: any) => {
      let q = query.is("deleted_at", null);
      if (isGlobalSession(session)) return q;
      if (assignedOnly || (session?.isShippingScoped && clearingAgentIds.length > 0)) {
        return clearingAgentIds.length > 0
          ? q.or(`assigned_to_user_id.eq.${session.userId},clearing_agent_id.in.(${clearingAgentIds.join(",")})`)
          : q.eq("assigned_to_user_id", session.userId);
      }
      return enforceScopeFilter(q, session);
    };

    let shipmentsQuery = supabase
      .from("shipping_bl_records")
      .select("id, shipping_line_name, bl_number, container_number, vessel_name, eta, shipment_status, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    shipmentsQuery = applyShipmentScope(shipmentsQuery);

    let tasksQuery = supabase
      .from("erp_assignments")
      .select("id, assignment_no, title, message, status, due_at, target_type")
      .order("created_at", { ascending: false })
      .limit(6);
    tasksQuery = applyTaskScope(tasksQuery);

    const [
      assignedShipments,
      clearingLegsPending,
      blCustomsHold,
      inTransit,
      delivered,
      trackedContainers,
      documents,
      pendingTasks,
      completedTasks,
      shipmentsResult,
      tasksResult,
    ] = await Promise.all([
      safeCount("shipping_bl_records", (query) => applyShipmentScope(query)),
      safeCount("clearing_customer_order_legs", (query) =>
        applyClearingScope(query).neq("customs_status", "cleared").neq("customs_status", "not_applicable")
      ),
      safeCount("shipping_bl_records", (query) =>
        applyShipmentScope(query).in("shipment_status", ["customs_hold", "arrived"])
      ),
      safeCount("shipping_bl_records", (query) =>
        applyShipmentScope(query).in("shipment_status", ["loaded", "in_transit", "sailing"])
      ),
      safeCount("shipping_bl_records", (query) =>
        applyShipmentScope(query).in("shipment_status", ["delivered", "cleared", "released"])
      ),
      safeCount("shipping_bl_records", (query) =>
        applyShipmentScope(query).not("container_number", "is", null).neq("container_number", "")
      ),
      safeCount("shipping_bl_records", (query) =>
        applyShipmentScope(query).not("bl_number", "is", null).neq("bl_number", "")
      ),
      safeCount("erp_assignments", (query) =>
        applyTaskScope(query).in("status", ["open", "pending", "in_progress"])
      ),
      safeCount("erp_assignments", (query) =>
        applyTaskScope(query).in("status", ["completed", "closed", "done"])
      ),
      withTimeout<QueryResult<any[]>>(shipmentsQuery, { data: [], error: { message: "Shipment list query timed out." } }),
      withTimeout<QueryResult<any[]>>(tasksQuery, { data: [], error: { message: "Task list query timed out." } }),
    ]);

    const shipmentRows = !shipmentsResult.error && Array.isArray(shipmentsResult.data) ? shipmentsResult.data : [];
    const taskRows = !tasksResult.error && Array.isArray(tasksResult.data) ? tasksResult.data : [];
    const queryError = shipmentsResult.error?.message || tasksResult.error?.message || null;
    const pendingClearance = clearingLegsPending + blCustomsHold;

    return {
      assignedShipments,
      pendingClearance,
      inTransit,
      trackedContainers,
      documents,
      delivered,
      completedShipments: delivered + completedTasks,
      pendingTasks,
      notifications: pendingTasks,
      shipments: shipmentRows.map((row: any) => ({
        id: String(row.id),
        shippingLineName: row.shipping_line_name || "-",
        blNumber: row.bl_number || "-",
        containerNumber: row.container_number || "-",
        vesselName: row.vessel_name || "-",
        eta: row.eta ? new Date(row.eta).toLocaleDateString("en-GB") : "-",
        status: row.shipment_status || "pending",
        date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "-",
      })),
      tasks: taskRows.map((row: any) => ({
        id: String(row.id),
        assignmentNo: row.assignment_no || "-",
        title: row.title || "-",
        message: row.message || "",
        status: row.status || "pending",
        dueAt: row.due_at ? new Date(row.due_at).toLocaleDateString("en-GB") : "-",
        targetType: row.target_type || "Task",
      })),
      databaseReady: !queryError,
      error: queryError,
    };
  } catch (error) {
    return {
      ...emptyData,
      databaseReady: false,
      error: error instanceof Error ? error.message : "Unable to load logistics dashboard data.",
    };
  }
}

export default async function LogisticsDashboardPage() {
  const session = await getCurrentErpSession();
  const data = await loadLogisticsDashboardData(session);
  const canCreateShipment = session ? hasRolePermission(session, "shipments", "create") : false;

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <LogisticsDashboardOverview data={data} canCreateShipment={canCreateShipment} />
    </main>
  );
}
