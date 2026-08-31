export type TaskStatus =
  | "new"
  | "accepted"
  | "in_progress"
  | "waiting"
  | "completed"
  | "verified"
  | "returned"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskListScope = "my" | "team" | "overdue" | "completed" | "all";

export type TaskEventType =
  | "created"
  | "assigned"
  | "reassigned"
  | "accepted"
  | "started"
  | "waiting"
  | "progress_note"
  | "comment"
  | "attachment_added"
  | "evidence_linked"
  | "completed"
  | "returned"
  | "verified"
  | "due_changed"
  | "priority_changed"
  | "cancelled";

export type TaskTransition =
  | "accept"
  | "start"
  | "hold"
  | "resume"
  | "complete"
  | "verify"
  | "return"
  | "reopen"
  | "cancel";

/** ERP modules a task can be linked to. Keep in sync with RELATED_MODULE_ROUTES. */
export const RELATED_MODULES = [
  "purchases",
  "local_purchase",
  "sales",
  "local_sales",
  "accounting",
  "journal",
  "ledger",
  "roznamcha",
  "cash_bank",
  "bill_expenses",
  "settlement",
  "hrm",
  "documents",
  "shipping",
  "clearing",
  "reports",
  "customer_inquiry",
  "other",
] as const;
export type RelatedModule = (typeof RELATED_MODULES)[number];

export type UserTaskRow = {
  id: string;
  task_no: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  remarks: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  department: string | null;
  created_by: string;
  assigned_to: string;
  related_module: string | null;
  related_record_table: string | null;
  related_record_id: string | null;
  related_record_label: string | null;
  related_route: string | null;
  priority: TaskPriority;
  start_date: string | null;
  due_at: string | null;
  status: TaskStatus;
  accepted_at: string | null;
  started_at: string | null;
  waiting_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  returned_at: string | null;
  cancelled_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  return_reason: string | null;
  completion_notes: string | null;
  evidence_record_table: string | null;
  evidence_record_id: string | null;
  evidence_reference_no: string | null;
  reassigned_from: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UserTaskListItem = UserTaskRow & {
  assignee_name: string | null;
  creator_name: string | null;
  verifier_name: string | null;
  country_name: string | null;
  country_branch_name: string | null;
  city_branch_name: string | null;
  is_overdue: boolean;
  attachment_count: number;
  unread_count: number;
};

export type UserTaskEvent = {
  id: string;
  task_id: string;
  actor_id: string;
  actor_name: string | null;
  event_type: TaskEventType;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  note: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type UserTaskAttachment = {
  id: string;
  task_id: string;
  kind: "instruction" | "evidence";
  uploaded_by: string;
  uploader_name: string | null;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  file: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
};

export type PerformanceRow = {
  user_id: string;
  user_name: string | null;
  country_id: string | null;
  country_name: string | null;
  total_assigned: number;
  completed: number;
  verified: number;
  in_progress: number;
  waiting: number;
  pending: number; // new + accepted
  overdue: number;
  returned: number;
  on_time_rate: number; // verified/completed that met the due date, as a fraction
};
