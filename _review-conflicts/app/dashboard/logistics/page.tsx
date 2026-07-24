import { LogisticsDashboardOverview, type LogisticsDashboardData } from "@/features/dashboard/components/logistics-dashboard-overview";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    let query: QueryBuilder = supabase.from(table).select("id", { count: "exact", head: true });
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

async function loadLogisticsDashboardData(): Promise<LogisticsDashboardData> {
  try {
    const supabase = createSupabaseAdminClient();

    const [
      assignedShipments,
      pendingTasks,
      completedTasks,
      inTransit,
      delivered,
      trackedContainers,
      shipmentsResult,
      tasksResult,
    ] = await Promise.all([
      safeCount("shipping_bl_records", (query) => query.is("deleted_at", null)),
      safeCount("erp_assignments", (query) => query.is("deleted_at", null).in("status", ["open", "pending", "in_progress"])),
      safeCount("erp_assignments", (query) => query.is("deleted_at", null).in("status", ["completed", "closed", "done"])),
      safeCount("shipping_bl_records", (query) => query.is("deleted_at", null).in("shipment_status", ["loaded", "in_transit", "sailing", "draft"])),
      safeCount("shipping_bl_records", (query) => query.is("deleted_at", null).in("shipment_status", ["delivered", "cleared", "released"])),
      safeCount("shipping_bl_records", (query) => query.is("deleted_at", null).not("container_number", "is", null)),
      withTimeout<QueryResult<any[]>>(
        supabase
          .from("shipping_bl_records")
          .select("id, shipping_line_name, bl_number, container_number, vessel_name, eta, shipment_status")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        { data: [], error: { message: "Shipment list query timed out." } }
      ),
      withTimeout<QueryResult<any[]>>(
        supabase
          .from("erp_assignments")
          .select("id, assignment_no, title, message, status, due_at, target_type")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6),
        { data: [], error: { message: "Task list query timed out." } }
      ),
    ]);

    const shipmentRows = !shipmentsResult.error && Array.isArray(shipmentsResult.data) ? shipmentsResult.data : [];
    const taskRows = !tasksResult.error && Array.isArray(tasksResult.data) ? tasksResult.data : [];
    const queryError = shipmentsResult.error?.message || tasksResult.error?.message || null;

    return {
      assignedShipments,
      pendingClearance: pendingTasks + Math.max(assignedShipments - delivered, 0),
      inTransit,
      trackedContainers,
      documents: assignedShipments,
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
        eta: row.eta || "-",
        status: row.shipment_status || "pending",
      })),
      tasks: taskRows.map((row: any) => ({
        id: String(row.id),
        assignmentNo: row.assignment_no || "-",
        title: row.title || "-",
        message: row.message || "",
        status: row.status || "pending",
        dueAt: row.due_at || "",
        targetType: row.target_type || "",
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
  const data = await loadLogisticsDashboardData();

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <LogisticsDashboardOverview data={data} />
    </main>
  );
}

