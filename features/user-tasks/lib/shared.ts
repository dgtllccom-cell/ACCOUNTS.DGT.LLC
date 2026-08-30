export type TaskStatus =
  | "new" | "accepted" | "in_progress" | "waiting" | "completed" | "verified" | "returned" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskListItem = {
  id: string;
  task_no: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  start_date: string | null;
  assigned_to: string;
  assignee_name: string | null;
  created_by: string;
  creator_name: string | null;
  verifier_name: string | null;
  country_id: string | null;
  country_name: string | null;
  country_branch_name: string | null;
  city_branch_name: string | null;
  department: string | null;
  related_module: string | null;
  related_record_label: string | null;
  related_route: string | null;
  is_overdue: boolean;
  attachment_count: number;
  unread_count: number;
  updated_at: string;
  created_at: string;
};

export const STATUS_ORDER: TaskStatus[] = [
  "new", "accepted", "in_progress", "waiting", "completed", "verified", "returned", "cancelled",
];

export function statusKey(st: TaskStatus): string {
  return `st_${st}`;
}
export function priorityKey(p: TaskPriority): string {
  return `pr_${p}`;
}

export function statusTone(st: TaskStatus): string {
  switch (st) {
    case "new": return "bg-slate-100 text-slate-700 ring-slate-200";
    case "accepted": return "bg-sky-100 text-sky-700 ring-sky-200";
    case "in_progress": return "bg-indigo-100 text-indigo-700 ring-indigo-200";
    case "waiting": return "bg-amber-100 text-amber-700 ring-amber-200";
    case "completed": return "bg-blue-100 text-blue-700 ring-blue-200";
    case "verified": return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "returned": return "bg-rose-100 text-rose-700 ring-rose-200";
    case "cancelled": return "bg-slate-100 text-slate-400 ring-slate-200 line-through";
    default: return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function priorityTone(p: TaskPriority): string {
  switch (p) {
    case "urgent": return "bg-rose-600 text-white";
    case "high": return "bg-orange-100 text-orange-700 ring-1 ring-orange-200";
    case "normal": return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    case "low": return "bg-slate-50 text-slate-400 ring-1 ring-slate-200";
    default: return "bg-slate-100 text-slate-600";
  }
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const RELATED_MODULE_ROUTES: Record<string, string> = {
  purchases: "/dashboard/purchase/purchase-order",
  local_purchase: "/dashboard/purchase/local-purchase",
  sales: "/dashboard/sales/sales-order",
  local_sales: "/dashboard/sales",
  accounting: "/dashboard/accounting",
  journal: "/dashboard/journal",
  ledger: "/dashboard/ledgers",
  roznamcha: "/dashboard/roznamcha",
  cash_bank: "/dashboard/cash",
  bill_expenses: "/dashboard/expenses/bill-expenses",
  settlement: "/dashboard/cash/settlement",
  hrm: "/dashboard/general-office/employees",
  documents: "/dashboard/documents-hub",
  shipping: "/dashboard/logistics",
  clearing: "/dashboard/logistics",
  reports: "/dashboard/reports",
  other: "",
};
