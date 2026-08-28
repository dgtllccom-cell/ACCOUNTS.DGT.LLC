"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";
import type { UaeTaxEntity, UaeTaxPeriod } from "@/features/uae-tax/types/uae-tax";

export function fmtAed(v: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
}

/** Loads the tax entities + periods used by the filter bar on most screens. */
export function useEntitiesAndPeriods() {
  const [entities, setEntities] = useState<UaeTaxEntity[]>([]);
  const [periods, setPeriods] = useState<UaeTaxPeriod[]>([]);
  const [entityId, setEntityId] = useState("");
  const [periodId, setPeriodId] = useState("");

  const reload = useCallback(async () => {
    try {
      const e = await apiGet<{ entities: UaeTaxEntity[] }>("/api/erp/uae-tax/entities");
      setEntities(e.entities ?? []);
      const qs = entityId ? `?taxEntityId=${entityId}` : "";
      const p = await apiGet<{ periods: UaeTaxPeriod[] }>(`/api/erp/uae-tax/periods${qs}`);
      setPeriods(p.periods ?? []);
    } catch {
      /* surfaced by the caller's own error handling */
    }
  }, [entityId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entities, periods, entityId, setEntityId, periodId, setPeriodId, reload };
}

export function FilterBar({
  entities,
  periods,
  entityId,
  setEntityId,
  periodId,
  setPeriodId,
  entityLabel,
  periodLabel,
  allEntities,
  allPeriods,
  children,
}: {
  entities: UaeTaxEntity[];
  periods: UaeTaxPeriod[];
  entityId: string;
  setEntityId: (v: string) => void;
  periodId: string;
  setPeriodId: (v: string) => void;
  entityLabel: string;
  periodLabel: string;
  allEntities: string;
  allPeriods: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {entityLabel}
        <select
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">{allEntities}</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.legal_name} — {e.trn}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {periodLabel}
        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">{allPeriods}</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.period_code}
            </option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}
