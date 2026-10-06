"use client";

/**
 * SmartSummary — the ONE shared "get to the point" layer for the whole ERP.
 *
 * A page passes a list of already-computed, authoritative facts. This component
 * only renders them — it never fetches, never totals, never guesses.
 *
 * RULES (owner contract, 2026-09-08):
 *  - Real authoritative ERP data only. Never invent a total.
 *  - Never label something Paid / Approved / Sent / Received unless the source
 *    ERP status actually says so — pass the label the record gives you.
 *  - IDs, amounts, Bill Nos, Container Nos and reference numbers are shown
 *    verbatim (this component applies NO translation to `value` / `amount`).
 *  - `label` is chrome → translate it on the page before passing it in.
 *  - Every item offers up to three actions: View Details / Open Record / Take Action.
 *
 * Usage:
 *   <SmartSummary
 *     title={s.t("summary", "At a glance")}
 *     items={[
 *       { key: "pay_overdue", tone: "bad", count: 2, label: s.t("pay_overdue","Payments overdue"),
 *         amount: "AED 25,000", viewHref: "/dashboard/reports/payments?status=overdue" },
 *       { key: "cont_recv", tone: "warn", count: 3, label: s.t("cont_recv","Containers awaiting receiving"),
 *         viewHref: "/dashboard/logistics/receiving" },
 *     ]}
 *   />
 */
import Link from "next/link";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export type SmartSummaryTone = "good" | "warn" | "bad" | "info" | "muted";

export interface SmartSummaryItem {
  key: string;
  /** the number the reader cares about (e.g. 2, 3, 4). Optional for a pure fact row. */
  count?: number | string;
  /** translated chrome label ("Payments overdue"). */
  label: string;
  /** a verbatim value — amount / bill no / container no. NEVER translated by this component. */
  amount?: string | null;
  tone?: SmartSummaryTone;
  /** "View Details" — a filtered list. */
  viewHref?: string;
  /** "Open Record" — the single authoritative record. */
  recordHref?: string;
  /** "Take Action" — the action screen for this item. */
  actionHref?: string;
  /** extra muted context ("oldest 12 days"). Chrome — translate before passing. */
  hint?: string;
}

const TONE: Record<SmartSummaryTone, { dot: string; ring: string; num: string }> = {
  good: { dot: "bg-emerald-500", ring: "border-s-emerald-500", num: "text-emerald-600" },
  warn: { dot: "bg-amber-500", ring: "border-s-amber-500", num: "text-amber-600" },
  bad: { dot: "bg-rose-500", ring: "border-s-rose-500", num: "text-rose-600" },
  info: { dot: "bg-sky-500", ring: "border-s-sky-500", num: "text-sky-600" },
  muted: { dot: "bg-slate-400", ring: "border-s-slate-400", num: "text-slate-500" },
};

export function SmartSummary({
  title,
  items,
  emptyText,
  lang: langProp,
  dense = false,
}: {
  title?: string;
  items: SmartSummaryItem[];
  emptyText?: string;
  lang?: string;
  dense?: boolean;
}) {
  const s = useErpScreen("smartsum", langProp);
  const { dir, textStart } = s;
  const shown = items.filter((i) => i && (i.count === undefined || Number(i.count) !== 0 || typeof i.count === "string"));

  return (
    <section dir={dir} className="rounded-xl border border-border bg-background p-3">
      {title && <h2 className={`mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground ${textStart}`}>{title}</h2>}
      {shown.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">{emptyText ?? s.t("all_clear", "Nothing needs attention right now.")}</p>
      ) : (
        <ul className={`grid gap-2 ${dense ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
          {shown.map((i) => {
            const tone = TONE[i.tone ?? "info"];
            return (
              <li key={i.key} className={`flex flex-col gap-1 rounded-lg border border-border border-s-4 ${tone.ring} bg-muted/20 p-2.5`}>
                <div className={`flex items-baseline gap-2 ${textStart}`}>
                  {i.count !== undefined && <span className={`text-lg font-black tabular-nums ${tone.num}`}>{i.count}</span>}
                  <span className="text-sm font-semibold">{i.label}</span>
                </div>
                {(i.amount || i.hint) && (
                  <div className={`flex flex-wrap items-center gap-2 text-xs ${textStart}`}>
                    {i.amount && <span className="font-mono font-bold tabular-nums">{i.amount}</span>}
                    {i.hint && <span className="text-muted-foreground">{i.hint}</span>}
                  </div>
                )}
                <div className={`mt-0.5 flex flex-wrap gap-2 text-xs ${textStart}`}>
                  {i.viewHref && (
                    <Link href={i.viewHref as never} className="font-semibold text-primary hover:underline">
                      {s.t("view_details", "View Details")}
                    </Link>
                  )}
                  {i.recordHref && (
                    <Link href={i.recordHref as never} className="font-semibold text-primary hover:underline">
                      {s.t("open_record", "Open Record")}
                    </Link>
                  )}
                  {i.actionHref && (
                    <Link href={i.actionHref as never} className="font-semibold text-primary hover:underline">
                      {s.t("take_action", "Take Action")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Shared adapter: turn the ERP-wide Smart Due / Smart Operations summary
 * (`GET /api/erp/smart-due/summary`) into SmartSummary items. Reuse this on any
 * dashboard so the "get to the point" numbers everywhere come from the same
 * authoritative aggregation — never a per-page re-count.
 */
export function smartDueSummaryToItems(
  summary: { overdue?: number; dueToday?: number; dueTomorrow?: number; pending?: number } | null | undefined,
  t: (k: string, f: string) => string,
): SmartSummaryItem[] {
  if (!summary) return [];
  return [
    { key: "sd_overdue", tone: "bad", count: summary.overdue ?? 0, label: t("sd_overdue", "Overdue actions"), viewHref: "/dashboard/smart-operations" },
    { key: "sd_today", tone: "warn", count: summary.dueToday ?? 0, label: t("sd_today", "Due today"), viewHref: "/dashboard/smart-operations" },
    { key: "sd_tomorrow", tone: "info", count: summary.dueTomorrow ?? 0, label: t("sd_tomorrow", "Due tomorrow"), viewHref: "/dashboard/smart-operations" },
    { key: "sd_pending", tone: "muted", count: summary.pending ?? 0, label: t("sd_pending", "Pending items"), viewHref: "/dashboard/smart-operations" },
  ];
}
