"use client";
import { type ReportFieldDefinition, type ReportGroupConfig } from "./types";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type GroupByManagerProps = {
  fields: ReportFieldDefinition[];
  groupBy: ReportGroupConfig;
  onChange: (groupBy: ReportGroupConfig) => void;
};

/** "Add Group" — group report rows by a chosen field, with an optional subtotal row per group. */
export function GroupByManager({ fields, groupBy, onChange }: GroupByManagerProps) {
  const lang = useActiveLanguage();
  const groupableFields = fields.filter((f) => f.type !== "number" && f.type !== "currency");

  return (
    <div className="space-y-3 p-2">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        {t(lang, "report.builder_group_by", "Group By")}
      </div>
      <select
        value={groupBy?.fieldId ?? ""}
        onChange={(e) => {
          const fieldId = e.target.value || null;
          onChange(fieldId ? { fieldId, showSubtotals: groupBy?.showSubtotals ?? true } : null);
        }}
        className="w-full h-9 text-xs bg-white dark:bg-slate-950 border rounded px-2"
      >
        <option value="">{t(lang, "report.builder_no_grouping", "No grouping")}</option>
        {groupableFields.map((f) => (
          <option key={f.id} value={f.id}>
            {translateHeader(lang, f.label)}
          </option>
        ))}
      </select>

      {groupBy?.fieldId ? (
        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={groupBy.showSubtotals}
            onChange={(e) => onChange({ fieldId: groupBy.fieldId, showSubtotals: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {t(lang, "report.builder_show_group_subtotals", "Show subtotals per group")}
        </label>
      ) : null}
    </div>
  );
}
