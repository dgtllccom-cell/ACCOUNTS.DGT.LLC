import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { recordInSessionScope } from "@/lib/api/scope-middleware";
import { rowInSessionDomain } from "@/lib/permissions/domain-scope";
import { canDecideChainStage, chainOf } from "@/lib/approval/account-approval-chain";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/accounting/account-approvals[?status=pending|approved|rejected|all]
 *
 * The Shipping Line account approval queue + history. It reads the EXISTING approval_requests / approval_status_history
 * records (no second approval system) of accounts that carry the two-stage chain (Country Admin -> Operations Country Admin).
 * A login sees a request when it raised it, or when the request is inside its scope (country / branch / domain). `canDecide`
 * tells the screen whether THIS login may decide the request's current stage; the decision itself is PATCH /api/erp/approvals/{id}.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const status = request.nextUrl.searchParams.get("status") ?? "pending";

    const data = await withLocalPg(async (sql) => {
      const reqs = (await sql`
        select ar.id, ar.request_no, ar.status, ar.target_id, ar.country_id, ar.country_branch_id, ar.city_branch_id,
               ar.requested_by, ar.created_at, ar.decided_at, ar.after_data, ar.rejection_reason,
               p.full_name as requested_by_name,
               ea.code as account_code, ea.name as account_name, ea.status as account_status, ea.operational_domain,
               cb.name as city_branch_name
        from public.approval_requests ar
        join public.enterprise_accounts ea on ea.id = ar.target_id
        left join public.profiles p on p.id = ar.requested_by
        left join public.city_branches cb on cb.id = ar.city_branch_id
        where ar.target_table = 'enterprise_accounts' and ar.deleted_at is null
          and (case when jsonb_typeof(ar.after_data) = 'string' then (ar.after_data #>> '{}')::jsonb else ar.after_data end) ? 'approvalChain'
          and (${status === "all" ? sql`true` : sql`ar.status::text = ${status}`})
        order by ar.created_at desc
        limit 200
      `) as unknown as any[];

      const visible = reqs.filter((r) => {
        if (session.isSuperAdmin) return true;
        if (!rowInSessionDomain(session, r.operational_domain)) return false;
        if (r.requested_by === session.userId) return true;
        if (session.roles.includes("global_operations_admin")) return true;
        if (session.roles.some((x) => x === "country_admin" || x === "country_operations_admin")) {
          return Boolean(r.country_id && session.countryIds.includes(r.country_id));
        }
        return recordInSessionScope(session, r);
      });

      const ids = visible.map((r) => r.id);
      const history = ids.length
        ? ((await sql`
            select h.approval_request_id, h.from_status, h.to_status, h.note, h.created_at, h.actor_id, pr.full_name as actor_name
            from public.approval_status_history h
            left join public.profiles pr on pr.id = h.actor_id
            where h.approval_request_id = any(${ids}::uuid[])
            order by h.created_at asc
          `) as unknown as any[])
        : [];
      return { visible, history };
    });

    // Human-readable names follow the viewer's language (account / branch / user names are translatable master data).
    let visibleRows: any[] = data?.visible ?? [];
    let historyRows: any[] = data?.history ?? [];
    try {
      visibleRows = await localizeJoinedNames(visibleRows, lang, [
        { idField: "requested_by", nameField: "requested_by_name", table: "profiles", field: "full_name" },
        { idField: "target_id", nameField: "account_name", table: "enterprise_accounts", field: "name" },
        { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches", field: "name" },
      ]);
      historyRows = await localizeJoinedNames(historyRows, lang, [{ idField: "actor_id", nameField: "actor_name", table: "profiles", field: "full_name" }]);
    } catch {
      // keep the original names
    }

    const rows = visibleRows.map((r) => {
      const chain = chainOf(r.after_data);
      const stage = Number(chain?.approvalStage ?? 1);
      const stageDef = (chain?.approvalChain ?? []).find((s) => s.stage === stage) ?? null;
      return {
        id: r.id,
        requestNo: r.request_no,
        status: r.status,
        accountId: r.target_id,
        accountCode: r.account_code,
        accountName: r.account_name,
        accountStatus: r.account_status,
        operationalDomain: r.operational_domain,
        cityBranchName: r.city_branch_name,
        requestedBy: r.requested_by,
        requestedByName: r.requested_by_name,
        createdAt: r.created_at,
        decidedAt: r.decided_at,
        rejectionReason: r.rejection_reason,
        stage,
        stageLabel: stageDef?.label ?? null,
        totalStages: chain?.approvalChain?.length ?? 0,
        stageApprovals: chain?.stageApprovals ?? [],
        canDecide: r.status === "pending" && Boolean(stageDef) && canDecideChainStage(session, stageDef!.role, { country_id: r.country_id, requested_by: r.requested_by, operational_domain: r.operational_domain }),
        history: historyRows.filter((h) => h.approval_request_id === r.id),
      };
    });

    return apiOk({ requests: rows });
  } catch (error) {
    return handleApiError(error);
  }
}
