"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import type { JournalChartKey } from "./default-config";
import type { ErpScreen } from "@/lib/i18n/use-erp-screen";

export type JournalChartsData = {
  debitVsCredit: Array<{ name: string; value: number }>;
  movementByDate: Array<{ date: string; debit: number; credit: number }>;
  accountWise: Array<{ name: string; debit: number; credit: number }>;
  branchWise: Array<{ name: string; debit: number; credit: number }>;
  currencyWise: Array<{ name: string; debit: number; credit: number }>;
};

const COLORS = {
  debit: "var(--jrpt-debit, #f59e0b)",
  credit: "var(--jrpt-credit, #10b981)",
  bar1: "#3b82f6",
  bar2: "#8b5cf6"
};

const PIE_COLORS = ["#f59e0b", "#10b981"];

function ChartCard({ title, isRtl, empty, emptyLabel, children }: { title: string; isRtl: boolean; empty: boolean; emptyLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" dir={isRtl ? "rtl" : "ltr"}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {empty ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">{emptyLabel}</div>
      ) : (
        <div style={{ width: "100%", height: 220 }}>{children}</div>
      )}
    </div>
  );
}

export function JournalReportingCharts({
  data,
  visibleCharts,
  s
}: {
  data: JournalChartsData;
  visibleCharts: JournalChartKey[];
  s: ErpScreen;
}) {
  const emptyLabel = s.t("no_chart_data", "No data for the selected filters");
  const show = (key: JournalChartKey) => visibleCharts.includes(key);

  if (visibleCharts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {show("debitVsCredit") && (
        <ChartCard
          title={s.t("chart_debit_vs_credit", "Debit vs Credit")}
          isRtl={s.isRtl}
          empty={data.debitVsCredit.every((d) => !d.value)}
          emptyLabel={emptyLabel}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data.debitVsCredit} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                {data.debitVsCredit.map((entry, idx) => (
                  <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {show("movementByDate") && (
        <ChartCard
          title={s.t("chart_movement_by_date", "Movement by Date")}
          isRtl={s.isRtl}
          empty={data.movementByDate.length === 0}
          emptyLabel={emptyLabel}
        >
          <ResponsiveContainer>
            <LineChart data={data.movementByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="debit" stroke={COLORS.debit} strokeWidth={2} dot={false} name={s.t("dr_cr_debit", "Debit")} />
              <Line type="monotone" dataKey="credit" stroke={COLORS.credit} strokeWidth={2} dot={false} name={s.t("dr_cr_credit", "Credit")} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {show("accountWise") && (
        <ChartCard
          title={s.t("chart_account_wise", "Account-wise Breakdown")}
          isRtl={s.isRtl}
          empty={data.accountWise.length === 0}
          emptyLabel={emptyLabel}
        >
          <ResponsiveContainer>
            <BarChart data={data.accountWise} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="debit" fill={COLORS.debit} name={s.t("dr_cr_debit", "Debit")} />
              <Bar dataKey="credit" fill={COLORS.credit} name={s.t("dr_cr_credit", "Credit")} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {show("branchWise") && (
        <ChartCard
          title={s.t("chart_branch_wise", "Branch-wise Breakdown")}
          isRtl={s.isRtl}
          empty={data.branchWise.length === 0}
          emptyLabel={emptyLabel}
        >
          <ResponsiveContainer>
            <BarChart data={data.branchWise}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="debit" fill={COLORS.bar1} name={s.t("dr_cr_debit", "Debit")} />
              <Bar dataKey="credit" fill={COLORS.bar2} name={s.t("dr_cr_credit", "Credit")} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {show("currencyWise") && (
        <ChartCard
          title={s.t("chart_currency_wise", "Currency-wise Breakdown")}
          isRtl={s.isRtl}
          empty={data.currencyWise.length === 0}
          emptyLabel={emptyLabel}
        >
          <ResponsiveContainer>
            <BarChart data={data.currencyWise}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="debit" fill={COLORS.debit} name={s.t("dr_cr_debit", "Debit")} />
              <Bar dataKey="credit" fill={COLORS.credit} name={s.t("dr_cr_credit", "Credit")} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
