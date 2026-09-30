/**
 * CRM Insights — 8 real, rule-based insight categories over existing ERP data.
 *
 * Every number and row here comes from a real, scoped SQL query against existing
 * tables (customer_inquiries, crm_action_items, crm_followup_notes). "Next Best
 * Action" is a deterministic recommendation computed from the row's own real
 * fields (days overdue, amount, stage) — never a fabricated AI claim. A category
 * with zero real matches reports an honest empty state, not a placeholder number.
 *
 * Categories: HOT_LEAD, STALE_LEAD, FOLLOW_UP_MISSED, CALLBACK_TODAY,
 * QUOTATION_NO_RESPONSE, OLD_CUSTOMER_REACTIVATION, PAYMENT_FOLLOW_UP,
 * NO_NEXT_ACTION.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withReadPg } from "@/lib/db/local-postgres";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { visibilityClause, build } from "@/lib/customer-inquiry/service";
import { reactivationCandidates } from "@/lib/customer-inquiry/conversation-service";

export type InsightCategory =
  | "hot_lead"
  | "stale_lead"
  | "follow_up_missed"
  | "callback_today"
  | "quotation_no_response"
  | "old_customer_reactivation"
  | "payment_follow_up"
  | "no_next_action";

export type InsightRow = {
  id: string;
  title: string;
  subtitle: string | null;
  detail: string | null;
  href: string;
  nextBestAction: string;
  country: string | null;
};

export type InsightGroup = { category: InsightCategory; count: number; rows: InsightRow[] };

const LIMIT = 30;

/**
 * crm_action_items keeps its scope ids as text — this re-selects the real columns
 * this service needs and RENAMES the uuid-cast scope columns back onto
 * country_id/country_branch_id/city_branch_id (shadowing the original varchar
 * columns, which are not selected), exactly like the proven
 * stale_crm_followup detector in smart-operations-detectors.ts does. Never use
 * `x.*` here — a plain `x.*` would keep the original varchar columns and break
 * sqlScopeCondition's `= ANY($uuid[])` comparison.
 */
function actionItemsScopedCte(sql: any, extraWhere: string) {
  return sql.unsafe(`
    SELECT
      x.id, x.reference_no, x.party_name, x.item_type, x.due_date, x.remaining_amount, x.currency,
      x.country_name, x.branch_name, x.responsible_user_id, x.next_follow_up, x.is_completed, x.urgency_class, x.created_at,
      CASE WHEN x.country_id::text ~* '^[0-9a-f-]{36}$' THEN x.country_id::text::uuid END AS country_id,
      CASE WHEN x.country_branch_id::text ~* '^[0-9a-f-]{36}$' THEN x.country_branch_id::text::uuid END AS country_branch_id,
      CASE WHEN x.city_branch_id::text ~* '^[0-9a-f-]{36}$' THEN x.city_branch_id::text::uuid END AS city_branch_id
    FROM public.crm_action_items x
    WHERE ${extraWhere}
  `);
}

// ─── 1. HOT LEAD ───────────────────────────────────────────────────────────
// Real signal: advanced funnel stage (qualified/quotation_sent/negotiation) +
// recent activity (moved in the last 7 days) + contactable. Transparent, no ML.
async function hotLeads(session: ErpSession): Promise<InsightGroup> {
  const rows = await withReadPg(async (sql) => {
    const vis = visibilityClause(session);
    const q = build(
      `select i.id, i.inquiry_no, i.customer_name, i.company_name, i.pipeline_stage, i.pipeline_stage_updated_at,
              i.mobile, i.whatsapp, i.email, c.name as country_name
       from public.customer_inquiries i left join public.countries c on c.id = i.country_id
       where i.deleted_at is null and ${vis.text}
         and i.pipeline_stage in ('qualified','quotation_sent','negotiation')
         and i.pipeline_stage_updated_at > now() - interval '7 days'
       order by i.pipeline_stage_updated_at desc limit ${LIMIT}`,
      vis.params,
    );
    return sql.unsafe(q.text, q.values);
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "hot_lead",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.customer_name,
      subtitle: r.company_name,
      detail: `${r.pipeline_stage.replace(/_/g, " ")} · moved ${daysAgo(r.pipeline_stage_updated_at)}`,
      href: `/dashboard/customer-inquiries?id=${r.id}`,
      nextBestAction: `Call now — advanced to "${r.pipeline_stage.replace(/_/g, " ")}" recently and is still active.`,
      country: r.country_name,
    })),
  };
}

// ─── 2. STALE LEAD ─────────────────────────────────────────────────────────
// Open pipeline stage (not won/lost) with no stage movement for 14+ days.
async function staleLeads(session: ErpSession): Promise<InsightGroup> {
  const rows = await withReadPg(async (sql) => {
    const vis = visibilityClause(session);
    const q = build(
      `select i.id, i.inquiry_no, i.customer_name, i.company_name, i.pipeline_stage, i.pipeline_stage_updated_at, c.name as country_name
       from public.customer_inquiries i left join public.countries c on c.id = i.country_id
       where i.deleted_at is null and ${vis.text}
         and i.pipeline_stage not in ('won','lost')
         and i.pipeline_stage_updated_at < now() - interval '14 days'
       order by i.pipeline_stage_updated_at asc limit ${LIMIT}`,
      vis.params,
    );
    return sql.unsafe(q.text, q.values);
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "stale_lead",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.customer_name,
      subtitle: r.company_name,
      detail: `Stuck at "${r.pipeline_stage.replace(/_/g, " ")}" for ${daysAgo(r.pipeline_stage_updated_at)}`,
      href: `/dashboard/customer-inquiries?id=${r.id}`,
      nextBestAction: `Re-engage — no pipeline movement in ${daysAgo(r.pipeline_stage_updated_at)}. Confirm it is still active or mark it lost.`,
      country: r.country_name,
    })),
  };
}

// ─── 3. FOLLOW-UP MISSED ───────────────────────────────────────────────────
// Real existing field: customer_inquiries with a follow_up_date already in the past.
async function followUpMissed(session: ErpSession): Promise<InsightGroup> {
  const rows = await withReadPg(async (sql) => {
    const vis = visibilityClause(session);
    const q = build(
      `select i.id, i.inquiry_no, i.customer_name, i.company_name, i.follow_up_date, c.name as country_name
       from public.customer_inquiries i left join public.countries c on c.id = i.country_id
       where i.deleted_at is null and ${vis.text}
         and i.follow_up_date is not null and i.follow_up_date < (now() at time zone 'UTC')::date
         and i.status not in ('converted','closed','lost')
       order by i.follow_up_date asc limit ${LIMIT}`,
      vis.params,
    );
    return sql.unsafe(q.text, q.values);
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "follow_up_missed",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.customer_name,
      subtitle: r.company_name,
      detail: `Follow-up was due ${r.follow_up_date}`,
      href: `/dashboard/customer-inquiries?id=${r.id}`,
      nextBestAction: `Contact immediately — follow-up date (${r.follow_up_date}) has passed.`,
      country: r.country_name,
    })),
  };
}

// ─── 4. CALLBACK TODAY ──────────────────────────────────────────────────────
// Real field: crm_followup_notes.promise_date = today, on the still-open action item.
async function callbackToday(session: ErpSession): Promise<InsightGroup> {
  const scope = sessionSqlScope(session);
  const rows = await withReadPg(async (sql) => {
    const cte = actionItemsScopedCte(sql, "coalesce(x.is_completed,false) = false");
    return sql`
      with items as (${cte}),
      latest_promise as (
        select distinct on (n.crm_item_id) n.crm_item_id, n.promise_date, n.note_text
        from public.crm_followup_notes n
        where n.promise_date = current_date
        order by n.crm_item_id, n.created_at desc
      )
      select i.id, i.reference_no, i.party_name, i.remaining_amount, i.currency, i.country_name, i.item_type, p.note_text
      from items i
      join latest_promise p on p.crm_item_id = i.id
      where ${sqlScopeCondition(sql, scope, "i", { prefix: "" })}
      order by i.party_name limit ${LIMIT}
    `;
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "callback_today",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.party_name,
      subtitle: r.reference_no,
      detail: r.note_text || r.item_type,
      href: "/dashboard/smart-due",
      nextBestAction: `Call before end of day — a callback was promised for today.`,
      country: r.country_name,
    })),
  };
}

// ─── 5. QUOTATION SENT — NO RESPONSE ───────────────────────────────────────
// Real field: pipeline_stage = 'quotation_sent' with no advance for 5+ days.
async function quotationNoResponse(session: ErpSession): Promise<InsightGroup> {
  const rows = await withReadPg(async (sql) => {
    const vis = visibilityClause(session);
    const q = build(
      `select i.id, i.inquiry_no, i.customer_name, i.company_name, i.quotation_sent_at, i.quotation_value, i.quotation_currency, c.name as country_name
       from public.customer_inquiries i left join public.countries c on c.id = i.country_id
       where i.deleted_at is null and ${vis.text}
         and i.pipeline_stage = 'quotation_sent'
         and i.quotation_sent_at is not null and i.quotation_sent_at < now() - interval '5 days'
       order by i.quotation_sent_at asc limit ${LIMIT}`,
      vis.params,
    );
    return sql.unsafe(q.text, q.values);
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "quotation_no_response",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.customer_name,
      subtitle: r.company_name,
      detail: r.quotation_value != null ? `${r.quotation_currency ?? ""} ${Number(r.quotation_value).toLocaleString()} · sent ${daysAgo(r.quotation_sent_at)}` : `Sent ${daysAgo(r.quotation_sent_at)}`,
      href: `/dashboard/customer-inquiries?id=${r.id}`,
      nextBestAction: `Follow up on the quotation sent ${daysAgo(r.quotation_sent_at)} — no response yet.`,
      country: r.country_name,
    })),
  };
}

// ─── 6. OLD CUSTOMER REACTIVATION ──────────────────────────────────────────
// Reuses the existing, already-real reactivationCandidates() — not duplicated.
async function oldCustomerReactivation(session: ErpSession): Promise<InsightGroup> {
  const candidates = await reactivationCandidates(session, { days: 90, includeLost: true });
  const list = (candidates as any[]).slice(0, LIMIT);
  return {
    category: "old_customer_reactivation",
    count: (candidates as any[]).length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.customer_name,
      subtitle: r.company_name,
      detail: `${r.idle_days} days idle · score ${r.score}`,
      href: `/dashboard/customer-inquiries/reactivation`,
      nextBestAction: r.talkingPoints?.[0] || `Reach out — no activity for ${r.idle_days} days.`,
      country: null,
    })),
  };
}

// ─── 7. PAYMENT FOLLOW-UP REQUIRED ─────────────────────────────────────────
// Real overdue receivable action items (Sales Recovery / Collect From Customer).
async function paymentFollowUp(session: ErpSession): Promise<InsightGroup> {
  const scope = sessionSqlScope(session);
  const rows = await withReadPg(async (sql) => {
    const cte = actionItemsScopedCte(
      sql,
      "coalesce(x.is_completed,false) = false and x.item_type in ('Sales Recovery','Collect From Customer') and x.urgency_class = 'overdue'",
    );
    return sql`
      with items as (${cte})
      select i.id, i.reference_no, i.party_name, i.remaining_amount, i.currency, i.due_date, i.country_name
      from items i
      where ${sqlScopeCondition(sql, scope, "i", { prefix: "" })}
      order by i.due_date asc limit ${LIMIT}
    `;
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "payment_follow_up",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.party_name,
      subtitle: r.reference_no,
      detail: `${r.currency} ${Number(r.remaining_amount).toLocaleString()} · due ${r.due_date}`,
      href: "/dashboard/smart-due",
      nextBestAction: `Send a payment reminder — ${r.currency} ${Number(r.remaining_amount).toLocaleString()} overdue since ${r.due_date}.`,
      country: r.country_name,
    })),
  };
}

// ─── 8. NO NEXT ACTION ASSIGNED ────────────────────────────────────────────
// Real gap: open action item with neither a responsible user nor a next follow-up date.
async function noNextAction(session: ErpSession): Promise<InsightGroup> {
  const scope = sessionSqlScope(session);
  const rows = await withReadPg(async (sql) => {
    const cte = actionItemsScopedCte(
      sql,
      "coalesce(x.is_completed,false) = false and (x.responsible_user_id is null or x.next_follow_up is null)",
    );
    return sql`
      with items as (${cte})
      select i.id, i.reference_no, i.party_name, i.item_type, i.responsible_user_id, i.next_follow_up, i.country_name
      from items i
      where ${sqlScopeCondition(sql, scope, "i", { prefix: "" })}
      order by i.created_at desc limit ${LIMIT}
    `;
  });
  const list = (rows as any[]) ?? [];
  return {
    category: "no_next_action",
    count: list.length,
    rows: list.map((r) => ({
      id: r.id,
      title: r.party_name,
      subtitle: r.reference_no,
      detail: r.item_type,
      href: "/dashboard/smart-due",
      nextBestAction: !r.responsible_user_id ? "Assign a responsible user." : "Set a next follow-up date.",
      country: r.country_name,
    })),
  };
}

function daysAgo(ts: string | Date): string {
  const d = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 86400000));
  return d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

export async function getCrmInsights(session: ErpSession): Promise<InsightGroup[]> {
  return Promise.all([
    hotLeads(session),
    staleLeads(session),
    followUpMissed(session),
    callbackToday(session),
    quotationNoResponse(session),
    oldCustomerReactivation(session),
    paymentFollowUp(session),
    noNextAction(session),
  ]);
}
