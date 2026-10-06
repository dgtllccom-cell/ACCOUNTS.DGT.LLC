"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { type ReportFieldDefinition } from "./types";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type ReportChartPanelProps = {
  data: any[];
  fields: ReportFieldDefinition[];
  groupFieldId: string | null;
  chartFieldId: string | null;
  onChartFieldChange: (fieldId: string | null) => void;
};

/** "Toggle Chart" — a bar chart of a chosen numeric field, aggregated by the active Group By
 * field (or by row index when nothing is grouped). Purely a visual summary of the already-
 * filtered report data; it never re-fetches or mutates it. */
export function ReportChartPanel({ data, fields, groupFieldId, chartFieldId, onChartFieldChange }: ReportChartPanelProps) {
  const lang = useActiveLanguage();
  const numericFields = fields.filter((f) => f.type === "number" || f.type === "currency");
  const activeFieldId = chartFieldId ?? numericFields[0]?.id ?? null;

  const chartData = useMemo(() => {
    if (!activeFieldId) return [];
    if (!groupFieldId) {
      // No grouping — chart raw rows (capped, so a large report doesn't render an unreadable axis).
      return data.slice(0, 50).map((row, i) => ({
        name: String(row[fields[0]?.id] ?? i + 1),
        value: Number(row[activeFieldId]) || 0
      }));
    }
    const totals = new Map<string, number>();
    for (const row of data) {
      const key = String(row[groupFieldId] ?? "—");
      totals.set(key, (totals.get(key) ?? 0) + (Number(row[activeFieldId]) || 0));
    }
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [data, activeFieldId, groupFieldId, fields]);

  if (numericFields.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500 italic text-center">
        {t(lang, "report.builder_no_numeric_fields", "No numeric fields available to chart.")}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {t(lang, "report.builder_chart_value", "Chart value")}
        </label>
        <select
          value={activeFieldId ?? ""}
          onChange={(e) => onChartFieldChange(e.target.value || null)}
          className="h-8 text-xs bg-white dark:bg-slate-950 border rounded px-2"
        >
          {numericFields.map((f) => (
            <option key={f.id} value={f.id}>
              {translateHeader(lang, f.label)}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full h-72" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
