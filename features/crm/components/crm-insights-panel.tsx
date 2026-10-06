"use client";

/**
 * CRM Insights — 8 real, rule-based categories (Hot Lead / Stale Lead / Follow-Up
 * Missed / Callback Today / Quotation Sent-No Response / Old Customer Reactivation /
 * Payment Follow-Up Required / No Next Action Assigned). Every number and row is
 * real ERP data with a real source link; "Next Best Action" is a deterministic
 * recommendation computed from the row's own fields, never a fabricated AI claim.
 * A category with zero real matches shows an honest empty state.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame, Clock3, CalendarClock, PhoneCall, FileWarning, RotateCcw, Wallet, UserX, Loader2, RefreshCw,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";

type InsightRow = { id: string; title: string; subtitle: string | null; detail: string | null; href: string; nextBestAction: string; country: string | null };
type InsightGroup = { category: string; count: number; rows: InsightRow[] };

const CATEGORY_META: Record<string, { icon: any; tone: string }> = {
  hot_lead: { icon: Flame, tone: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200" },
  stale_lead: { icon: Clock3, tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" },
  follow_up_missed: { icon: CalendarClock, tone: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200" },
  callback_today: { icon: PhoneCall, tone: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200" },
  quotation_no_response: { icon: FileWarning, tone: "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-200" },
  old_customer_reactivation: { icon: RotateCcw, tone: "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200" },
  payment_follow_up: { icon: Wallet, tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" },
  no_next_action: { icon: UserX, tone: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200" },
};

export function CrmInsightsPanel({ lang }: { lang?: string }) {
  const s = useErpScreen("cinsights", lang);
  const [groups, setGroups] = useState<InsightGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const r = await apiGet<{ groups: InsightGroup[] }>("/api/erp/crm/insights");
      setGroups(r.groups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGroups(null);
    }
  };
  useEffect(() => { void load(); }, []);

  const categoryLabel = (c: string) =>
    ({
      hot_lead: s.t("hot_lead", "Hot Lead"),
      stale_lead: s.t("stale_lead", "Stale Lead"),
      follow_up_missed: s.t("follow_up_missed", "Follow-Up Missed"),
      callback_today: s.t("callback_today", "Callback Today"),
      quotation_no_response: s.t("quotation_no_response", "Quotation Sent — No Response"),
      old_customer_reactivation: s.t("old_customer_reactivation", "Old Customer Reactivation"),
      payment_follow_up: s.t("payment_follow_up", "Payment Follow-Up Required"),
      no_next_action: s.t("no_next_action", "No Next Action Assigned"),
    })[c] ?? c;

  return (
    <section dir={s.dir} className="space-y-3" data-testid="cinsights-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{s.t("title", "CRM Insights")}</h2>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700">
          <RefreshCw className="h-3.5 w-3.5" />{s.tGlobal("common.refresh", "Refresh")}
        </button>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {groups === null ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((g) => {
            const meta = CATEGORY_META[g.category] || CATEGORY_META.no_next_action;
            const Icon = meta.icon;
            const isOpen = open === g.category;
            return (
              <div key={g.category} className={`rounded-2xl border p-3 ${meta.tone}`} data-testid={`cinsight-${g.category}`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.category)} className="flex w-full items-center justify-between text-left">
                  <span className="flex items-center gap-2 text-xs font-bold"><Icon className="h-4 w-4" />{categoryLabel(g.category)}</span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black dark:bg-slate-900/50">{g.count}</span>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-2 border-t border-black/10 pt-2 dark:border-white/10">
                    {g.rows.length === 0 ? (
                      <p className="py-3 text-center text-[11px] opacity-70">{s.t("empty", "Nothing here right now.")}</p>
                    ) : g.rows.slice(0, 8).map((r) => (
                      <Link key={r.id} href={r.href as any} className="block rounded-lg bg-white/60 p-2 text-[11px] hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70">
                        <div className="font-bold">{r.title}{r.subtitle ? <span className="ms-1 font-normal opacity-70">· {r.subtitle}</span> : null}</div>
                        {r.detail && <div className="opacity-70">{r.detail}</div>}
                        <div className="mt-1 font-semibold">→ {r.nextBestAction}</div>
                      </Link>
                    ))}
                    {g.rows.length > 8 && <p className="text-center text-[10px] opacity-60">+{g.rows.length - 8} {s.t("more", "more")}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
