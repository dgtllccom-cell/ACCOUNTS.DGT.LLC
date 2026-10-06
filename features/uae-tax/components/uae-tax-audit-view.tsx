"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet } from "@/lib/api/client";
import { FilterBar, useEntitiesAndPeriods } from "@/features/uae-tax/components/uae-tax-shared";

const ENTITY_TYPES = ["tax_line", "vat_return", "e_invoice", "recovery", "period", "entity", "rule"] as const;

export function UaeTaxAuditView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);
  const f = useEntitiesAndPeriods();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "300" });
      if (f.entityId) qs.set("taxEntityId", f.entityId);
      if (entityType) qs.set("entityType", entityType);
      const r = await apiGet<{ rows: any[] }>(`/api/erp/uae-tax/audit?${qs.toString()}`);
      setRows(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [f.entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              {s.t("nav_audit_logs", "Audit & Error Logs")}
            </h1>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.t("uae", "United Arab Emirates")}</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("cc_refresh", "Refresh")}
          </button>
        </header>

        <FilterBar {...f} entityLabel={s.t("cc_entity", "Tax Entity")} periodLabel={s.t("cc_period", "Tax Period")} allEntities={s.t("cc_all_entities", "All Entities")} allPeriods={s.t("cc_all_periods", "All Periods")}>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {s.t("au_entity_type", "Object Type")}
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
              <option value="">{s.t("au_all_types", "All Types")}</option>
              {ENTITY_TYPES.map((v) => <option key={v} value={v}>{s.t(`au_type_${v}`, v)}</option>)}
            </select>
          </label>
        </FilterBar>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("au_when", "When")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("au_type", "Object")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("au_action", "Action")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("au_actor", "Actor")}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wider text-slate-400">{s.t("au_change", "Change")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">{s.t("au_empty", "No audit records yet.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{s.t(`au_type_${r.entity_type}`, r.entity_type)}</td>
                    <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{s.t(`au_action_${r.action}`, r.action)}</td>
                    <td className="px-4 py-2 text-slate-500">{r.actor_name || "system"}</td>
                    <td className="max-w-md px-4 py-2 text-[11px] text-slate-400">{summariseChange(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function summariseChange(r: any): string {
  if (!r.before_state || !r.after_state) return "";
  const before = r.before_state as Record<string, unknown>;
  const after = r.after_state as Record<string, unknown>;
  const changed: string[] = [];
  for (const k of Object.keys(after)) {
    if (["updated_at", "synced_at"].includes(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed.push(`${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
    }
  }
  return changed.slice(0, 4).join("  ·  ");
}
