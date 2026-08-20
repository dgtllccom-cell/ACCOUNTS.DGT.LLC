import { withLocalPg } from "@/lib/db/local-postgres";
import { ErpSession } from "@/lib/auth/session";

export type AuditActionType =
  | "CREATE"
  | "EDIT"
  | "SOFT_DELETE"
  | "RESTORE"
  | "PERMANENT_DELETE"
  | "APPROVE"
  | "POST";

export interface FieldDiff {
  field: string;
  label?: string;
  oldValue: unknown;
  newValue: unknown;
}

export function computeFieldDiffs(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): FieldDiff[] {
  if (!before && !after) return [];
  if (!before && after) {
    return Object.keys(after).map((key) => ({
      field: key,
      oldValue: null,
      newValue: after[key]
    }));
  }
  if (before && !after) {
    return Object.keys(before).map((key) => ({
      field: key,
      oldValue: before[key],
      newValue: null
    }));
  }

  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  // Exclude system noise keys from diff view
  const ignoreKeys = new Set(["updated_at", "created_at", "version_number"]);

  for (const key of allKeys) {
    if (ignoreKeys.has(key)) continue;
    const oldVal = before?.[key];
    const newVal = after?.[key];

    const isDifferent =
      typeof oldVal === "object" || typeof newVal === "object"
        ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
        : oldVal !== newVal;

    if (isDifferent) {
      diffs.push({
        field: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null
      });
    }
  }

  return diffs;
}

export async function recordAuditEvent(input: {
  entityType: string;
  entityId: string;
  referenceNo?: string | null;
  actionType: AuditActionType;
  previousSnapshot?: Record<string, unknown> | null;
  currentSnapshot?: Record<string, unknown> | null;
  session?: ErpSession | null;
  reason?: string | null;
  ipAddress?: string | null;
  deviceSession?: string | null;
  countryId?: string | null;
  countryName?: string | null;
  cityBranchId?: string | null;
  branchName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return withLocalPg(async (sql) => {
    // 1. Determine latest version number
    const existing = await sql`
      SELECT COALESCE(MAX(version_number), 0) AS max_ver
      FROM enterprise_audit_events
      WHERE entity_type = ${input.entityType} AND entity_id = ${input.entityId}
    `;
    const nextVersion = Number(existing[0]?.max_ver || 0) + 1;

    // 2. Compute diffs
    const diffs = computeFieldDiffs(input.previousSnapshot, input.currentSnapshot);

    const isDeleted = input.actionType === "SOFT_DELETE" || input.actionType === "PERMANENT_DELETE";

    const userId = input.session?.userId || "system";
    const userName = input.session?.fullName || "System User";
    const userRole = input.session?.roles?.[0] || (input.session?.isSuperAdmin ? "super_admin" : "user");
    const countryId = input.countryId || input.session?.countryIds?.[0] || null;
    const cityBranchId = input.cityBranchId || input.session?.cityBranchIds?.[0] || null;

    const inserted = await sql`
      INSERT INTO enterprise_audit_events (
        entity_type,
        entity_id,
        reference_no,
        action_type,
        version_number,
        diff_changes,
        previous_snapshot,
        current_snapshot,
        user_id,
        user_name,
        user_role,
        country_id,
        country_name,
        city_branch_id,
        branch_name,
        ip_address,
        device_session,
        reason,
        metadata,
        is_deleted,
        deleted_at,
        deleted_by,
        created_at
      ) VALUES (
        ${input.entityType},
        ${input.entityId},
        ${input.referenceNo || null},
        ${input.actionType},
        ${nextVersion},
        ${JSON.stringify(diffs)},
        ${input.previousSnapshot ? JSON.stringify(input.previousSnapshot) : null},
        ${input.currentSnapshot ? JSON.stringify(input.currentSnapshot) : null},
        ${userId},
        ${userName},
        ${userRole},
        ${countryId},
        ${input.countryName || null},
        ${cityBranchId},
        ${input.branchName || null},
        ${input.ipAddress || null},
        ${input.deviceSession || null},
        ${input.reason || null},
        ${JSON.stringify(input.metadata || {})},
        ${isDeleted},
        ${isDeleted ? new Date().toISOString() : null},
        ${isDeleted ? userId : null},
        NOW()
      )
      RETURNING id, version_number, action_type, created_at;
    `;

    return inserted[0];
  });
}

export async function getEntityVersionTimeline(entityType: string, entityId: string) {
  return withLocalPg(async (sql) => {
    const events = await sql`
      SELECT 
        id,
        entity_type,
        entity_id,
        reference_no,
        action_type,
        version_number,
        diff_changes,
        previous_snapshot,
        current_snapshot,
        user_id,
        user_name,
        user_role,
        country_id,
        country_name,
        city_branch_id,
        branch_name,
        ip_address,
        device_session,
        reason,
        is_deleted,
        deleted_at,
        deleted_by,
        created_at
      FROM enterprise_audit_events
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY version_number ASC, created_at ASC;
    `;

    return events;
  });
}

export async function getMonthlyEditSummary(params: {
  year?: number;
  month?: number;
  countryId?: string | null;
  cityBranchId?: string | null;
}) {
  return withLocalPg(async (sql) => {
    const targetYear = params.year || new Date().getFullYear();
    const targetMonth = params.month || new Date().getMonth() + 1;

    // Overall stats for the month
    const overallStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE action_type = 'CREATE') AS total_created,
        COUNT(*) FILTER (WHERE action_type = 'EDIT') AS total_edits,
        COUNT(DISTINCT entity_id) FILTER (WHERE action_type = 'EDIT') AS unique_entities_edited,
        COUNT(*) FILTER (WHERE action_type = 'SOFT_DELETE') AS total_deleted,
        COUNT(*) FILTER (WHERE action_type = 'RESTORE') AS total_restored
      FROM enterprise_audit_events
      WHERE EXTRACT(YEAR FROM created_at) = ${targetYear}
        AND EXTRACT(MONTH FROM created_at) = ${targetMonth}
        ${params.countryId ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.cityBranchId ? sql`AND city_branch_id = ${params.cityBranchId}` : sql``}
    `;

    // Edits breakdown by entity type / module
    const moduleBreakdown = await sql`
      SELECT 
        entity_type,
        COUNT(*) AS edit_count,
        COUNT(DISTINCT entity_id) AS unique_records_edited
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${targetYear}
        AND EXTRACT(MONTH FROM created_at) = ${targetMonth}
        ${params.countryId ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.cityBranchId ? sql`AND city_branch_id = ${params.cityBranchId}` : sql``}
      GROUP BY entity_type
      ORDER BY edit_count DESC;
    `;

    // Edits breakdown by country
    const countryBreakdown = await sql`
      SELECT 
        COALESCE(country_name, country_id, 'Global / Unassigned') AS country_label,
        country_id,
        COUNT(*) AS edit_count
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${targetYear}
        AND EXTRACT(MONTH FROM created_at) = ${targetMonth}
      GROUP BY country_name, country_id
      ORDER BY edit_count DESC;
    `;

    // Top edited records list
    const topEditedRecords = await sql`
      SELECT 
        entity_type,
        entity_id,
        reference_no,
        country_name,
        branch_name,
        COUNT(*) AS edit_count,
        MAX(created_at) AS last_edited_at
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${targetYear}
        AND EXTRACT(MONTH FROM created_at) = ${targetMonth}
        ${params.countryId ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.cityBranchId ? sql`AND city_branch_id = ${params.cityBranchId}` : sql``}
      GROUP BY entity_type, entity_id, reference_no, country_name, branch_name
      ORDER BY edit_count DESC
      LIMIT 100;
    `;

    return {
      year: targetYear,
      month: targetMonth,
      stats: overallStats[0] || {},
      moduleBreakdown,
      countryBreakdown,
      topEditedRecords
    };
  });
}

export async function getDeletedRecords(params: {
  countryId?: string | null;
  cityBranchId?: string | null;
  entityType?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}) {
  return withLocalPg(async (sql) => {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const rows = await sql`
      SELECT 
        e.id,
        e.entity_type,
        e.entity_id,
        e.reference_no,
        e.version_number,
        e.current_snapshot,
        e.user_id,
        e.user_name,
        e.user_role,
        e.country_id,
        e.country_name,
        e.city_branch_id,
        e.branch_name,
        e.reason,
        e.deleted_at,
        e.deleted_by,
        e.created_at
      FROM enterprise_audit_events e
      WHERE e.action_type = 'SOFT_DELETE'
        ${params.countryId ? sql`AND e.country_id = ${params.countryId}` : sql``}
        ${params.cityBranchId ? sql`AND e.city_branch_id = ${params.cityBranchId}` : sql``}
        ${params.entityType ? sql`AND e.entity_type = ${params.entityType}` : sql``}
        ${params.search ? sql`AND (e.reference_no ILIKE ${`%${params.search}%`} OR e.entity_id ILIKE ${`%${params.search}%`} OR e.user_name ILIKE ${`%${params.search}%`})` : sql``}
      ORDER BY e.deleted_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countResult = await sql`
      SELECT COUNT(*) AS total
      FROM enterprise_audit_events
      WHERE action_type = 'SOFT_DELETE'
        ${params.countryId ? sql`AND country_id = ${params.countryId}` : sql``}
        ${params.cityBranchId ? sql`AND city_branch_id = ${params.cityBranchId}` : sql``}
        ${params.entityType ? sql`AND entity_type = ${params.entityType}` : sql``};
    `;

    return {
      records: rows,
      total: Number(countResult[0]?.total || 0),
      limit,
      offset
    };
  });
}
