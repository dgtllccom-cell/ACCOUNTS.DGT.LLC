"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Printer, Package, FileText, Receipt, Coins, Layers,
  TrendingUp, TrendingDown, BookCheck, CreditCard, ScrollText, History, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";

type Money = {
  originalCurrency: string;
  originalAmount: number;
  effectiveRate: number;
  convertedAmount: number;
  functionalCurrency: string;
};

function fmt(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qtyFmt(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function dt(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("en-GB") : "—";
}

export function BillDrilldownView({ id, lang: langProp }: { id: string; lang?: string }) {
  const s = useErpScreen("bexp", langProp);
  const scope = useErpScope();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/bill-expenses/${id}/drilldown`);
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      setData(j.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (m: Money | null | undefined) => {
    if (!m) return "—";
    if (m.originalCurrency === m.functionalCurrency || m.effectiveRate === 1) {
      return `${m.functionalCurrency} ${fmt(m.convertedAmount)}`;
    }
    return `${m.originalCurrency} ${fmt(m.originalAmount)} × ${m.effectiveRate} = ${m.functionalCurrency} ${fmt(m.convertedAmount)}`;
  };

  function printA4() {
    if (!data) return;
    const fc = data.functionalCurrency;
    const cols: GenericReportColumn[] = [
      { key: "rowSerial", label: s.t("dd_col_sr", "Sr"), align: "center" },
      { key: (r: any) => s.t(`etype_${r.expenseType}`, r.expenseType), label: s.t("dd_col_type", "Expense Type") },
      { key: (r: any) => r.details || "—", label: s.t("dd_col_details", "Details") },
      { key: (r: any) => money(r.amount), label: s.t("dd_col_amount", "Amount") },
      { key: (r: any) => `${r.taxPct}%`, label: s.t("dd_col_tax", "Tax"), align: "right" },
      { key: (r: any) => `${fc} ${fmt(r.grandAmount)}`, label: s.t("dd_col_grand", "Grand (Functional)"), align: "right" },
      { key: (r: any) => (r.postingStatus === "posted" ? (r.roznamcha?.journalNo || s.t("posting_posted", "Posted")) : s.t("posting_unposted", "Not posted")), label: s.t("dd_col_posting", "Accounting") }
    ];
    void openScopedGenericReport({
      title: s.t("dd_report_title", "Bill Cost & Profit — Drill-down"),
      subtitle: `${data.bill.billNo || "—"} · ${data.bill.branchLabel}`,
      lang: langProp,
      columns: cols,
      rows: (data.expenseLines || []) as Record<string, unknown>[],
      orientation: "portrait",
      countryId: scope.lockedCountryId ?? data.bill.country?.id ?? null,
      countryBranchId: scope.lockedCountryBranchId,
      cityBranchId: scope.lockedCityBranchId,
      countryName: scope.countryName ?? data.bill.country?.name,
      branchName: scope.branchDisplayName ?? data.bill.branchLabel,
      printedBy: scope.userName,
      filters: [
        { label: s.t("dd_bill_no", "Bill No."), value: data.bill.billNo || "—" },
        { label: s.t("dd_source", "Source"), value: s.t(`tab_${data.bill.sourceModule}`, data.bill.sourceModule) },
        { label: s.t("dd_party", "Party"), value: data.bill.party?.name || "—" },
        { label: s.t("dd_date", "Bill Date"), value: dt(data.bill.billDate) }
      ],
      summary: {
        [s.t("dd_original_cost", "Original Bill (Functional)")]: `${fc} ${fmt(data.cost.originalBillFunctional)}`,
        [s.t("dd_expense_total", "Posted Expense Total")]: `${fc} ${fmt(data.cost.postedExpenseTotal)}`,
        [s.t("dd_landed_cost", "Landed / Final Cost")]: `${fc} ${fmt(data.cost.landedCost)}`,
        [s.t("dd_qty_purchased", "Qty Purchased")]: qtyFmt(data.quantity.purchased),
        [s.t("dd_qty_sold", "Qty Sold")]: qtyFmt(data.quantity.sold),
        [s.t("dd_qty_remaining", "Qty Remaining")]: qtyFmt(data.quantity.remaining),
        [s.t("dd_remaining_value", "Remaining Value")]: `${fc} ${fmt(data.quantity.remainingValue)}`,
        [s.t("dd_revenue", "Revenue")]: `${fc} ${fmt(data.profitAndLoss.revenue)}`,
        [s.t("dd_profit", "Profit / Loss")]: data.profitAndLoss.profit == null ? "—" : `${fc} ${fmt(data.profitAndLoss.profit)}`
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-rose-600">
          {error || s.t("dd_not_found", "Bill not found.")}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="me-1 h-4 w-4" /> {s.t("retry", "Retry")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fc = data.functionalCurrency;
  const b = data.bill;
  const pnl = data.profitAndLoss;
  const profitPositive = (pnl.profit ?? 0) >= 0;

  const Section = ({ n, icon: Icon, title, children }: any) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {n}
          </span>
          <Icon className="h-4 w-4 text-slate-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{v}</span>
    </div>
  );

  return (
    <section dir={s.dir} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bill-cost-profit">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">{s.t("dd_title", "Bill Cost, Expenses & Profit — Drill-down")}</h1>
            <p className="text-xs text-slate-500">
              {b.billNo || "—"} · {s.t(`tab_${b.sourceModule}`, b.sourceModule)} · {b.branchLabel}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="me-1 h-4 w-4" /> {s.t("refresh", "Refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={printA4}>
            <Printer className="me-1 h-4 w-4" /> {s.t("dd_print", "Print A4")}
          </Button>
        </div>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: s.t("dd_landed_cost", "Landed / Final Cost"), value: `${fc} ${fmt(data.cost.landedCost)}`, icon: Layers },
          { label: s.t("dd_expense_total", "Posted Expense Total"), value: `${fc} ${fmt(data.cost.postedExpenseTotal)}`, icon: Coins },
          { label: s.t("dd_revenue", "Revenue"), value: `${fc} ${fmt(pnl.revenue)}`, icon: Receipt },
          {
            label: s.t("dd_profit", "Profit / Loss"),
            value: pnl.profit == null ? "—" : `${fc} ${fmt(pnl.profit)}`,
            icon: profitPositive ? TrendingUp : TrendingDown,
            tone: pnl.profit == null ? "" : profitPositive ? "text-emerald-600" : "text-rose-600"
          }
        ].map((c, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500"><c.icon className="h-3.5 w-3.5" /> {c.label}</div>
              <div className={`mt-1 text-base font-semibold tabular-nums ${c.tone || ""}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section n={1} icon={FileText} title={s.t("dd_s_bill", "Bill Details")}>
        <Row k={s.t("dd_bill_no", "Bill No.")} v={b.billNo || "—"} />
        <Row k={s.t("dd_manual_bill", "Manual Bill / Ref")} v={b.manualBillNo || "—"} />
        <Row k={s.t("dd_source", "Source Module")} v={s.t(`tab_${b.sourceModule}`, b.sourceModule)} />
        <Row k={s.t("dd_date", "Bill Date")} v={dt(b.billDate)} />
        <Row k={s.t("dd_party", "Party / Account")} v={b.party?.name || b.party?.accountNo || "—"} />
        <Row k={s.t("dd_country", "Country")} v={b.country?.name || "—"} />
        <Row k={s.t("dd_branch", "Branch")} v={b.branchLabel} />
        <Row k={s.t("dd_currency", "Currency")} v={b.currency || fc} />
        <Row k={s.t("dd_eligibility", "Eligibility")} v={s.t(`elig_${b.eligibility}`, b.eligibility)} />
      </Section>

      <Section n={2} icon={Package} title={s.t("dd_s_goods", "Goods")}>
        {data.goods.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_goods", "No goods lines on the source bill.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className={s.textStart + " py-1"}>{s.t("dd_col_sr", "Sr")}</th>
                  <th className={s.textStart}>{s.t("dd_g_name", "Goods")}</th>
                  <th className={s.textStart}>{s.t("dd_g_variation", "Variation")}</th>
                  <th className={s.textEnd}>{s.t("dd_g_qty", "Qty")}</th>
                  <th className={s.textEnd}>{s.t("dd_g_weight", "Weight (kg)")}</th>
                  <th className={s.textEnd}>{s.t("dd_g_rate", "Rate")}</th>
                  <th className={s.textEnd}>{s.t("dd_g_amount", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {data.goods.map((g: any) => (
                  <tr key={g.row} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1">{g.row}</td>
                    <td>{g.name}</td>
                    <td>{g.variation || "—"}</td>
                    <td className={s.textEnd + " tabular-nums"}>{qtyFmt(g.qty)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{qtyFmt(g.weightKgs)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{fmt(g.rate)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{fmt(g.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={3} icon={Receipt} title={s.t("dd_s_original", "Original Purchase / Sale")}>
        {data.original ? (
          <>
            <Row k={s.t("dd_o_type", "Type")} v={s.t(`src_${data.original.label}`, data.original.label)} />
            <Row k={s.t("dd_o_amount", "Original Amount")} v={money(data.original.amount)} />
            {data.original.landedCost && <Row k={s.t("dd_o_landed", "Recorded Landed Cost")} v={money(data.original.landedCost)} />}
            {data.sourceBill?.contractNo && <Row k={s.t("dd_o_contract", "Contract No.")} v={data.sourceBill.contractNo} />}
            {data.sourceBill?.customerName && <Row k={s.t("dd_o_customer", "Customer")} v={data.sourceBill.customerName} />}
            {data.sourceBill?.supplierName && <Row k={s.t("dd_o_supplier", "Supplier")} v={data.sourceBill.supplierName} />}
            {data.sourceBill?.route && <Row k={s.t("dd_o_route", "Route")} v={data.sourceBill.route} />}
            {data.sourceBill?.containerNo && <Row k={s.t("dd_o_container", "Container")} v={data.sourceBill.containerNo} />}
            {data.sourceBill?.status && <Row k={s.t("dd_o_status", "Status")} v={data.sourceBill.status} />}
          </>
        ) : (
          <p className="text-slate-500">{s.t("dd_no_source", "Source bill record not available.")}</p>
        )}
      </Section>

      <Section n={4} icon={Coins} title={s.t("dd_s_expenses", "Related Expense Bills")}>
        {data.expenseLines.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_expenses", "No additional expenses recorded.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className={s.textStart + " py-1"}>{s.t("dd_col_sr", "Sr")}</th>
                  <th className={s.textStart}>{s.t("dd_col_type", "Expense Type")}</th>
                  <th className={s.textStart}>{s.t("dd_col_details", "Details")}</th>
                  <th className={s.textEnd}>{s.t("dd_col_amount", "Amount")}</th>
                  <th className={s.textEnd}>{s.t("dd_col_grand", "Grand (Functional)")}</th>
                  <th className={s.textStart}>{s.t("dd_col_posting", "Accounting")}</th>
                </tr>
              </thead>
              <tbody>
                {data.expenseLines.map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1">{l.rowSerial}</td>
                    <td>{s.t(`etype_${l.expenseType}`, l.expenseType)}</td>
                    <td>{l.details || "—"}</td>
                    <td className={s.textEnd + " tabular-nums"}>{money(l.amount)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{fc} {fmt(l.grandAmount)}</td>
                    <td>
                      {l.postingStatus === "posted" ? (
                        <span className="text-emerald-600">
                          {l.roznamcha?.journalNo || s.t("posting_posted", "Posted")}
                        </span>
                      ) : (
                        <span className="text-amber-600">{s.t("posting_unposted", "Not posted")}</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={4} className={s.textEnd + " py-1.5"}>{s.t("dd_expense_total", "Posted Expense Total")}</td>
                  <td className={s.textEnd + " tabular-nums"}>{fc} {fmt(data.expenseTotals.posted)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={5} icon={CreditCard} title={s.t("dd_s_payments", "Payments")}>
        {data.payments.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_payments", "No payments recorded against the source bill.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className={s.textStart + " py-1"}>{s.t("dd_p_date", "Date")}</th>
                  <th className={s.textStart}>{s.t("dd_p_kind", "Kind")}</th>
                  <th className={s.textStart}>{s.t("dd_p_ref", "Reference")}</th>
                  <th className={s.textEnd}>{s.t("dd_col_amount", "Amount")}</th>
                  <th className={s.textStart}>{s.t("dd_p_status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1">{dt(p.date)}</td>
                    <td>{p.kind || "—"}</td>
                    <td>{p.referenceNo || "—"}</td>
                    <td className={s.textEnd + " tabular-nums"}>{money(p.amount)}</td>
                    <td>{p.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={6} icon={BookCheck} title={s.t("dd_s_drcr", "DR / CR Entries (Journal · Ledger · Roznamcha)")}>
        {data.drCrEntries.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_drcr", "No accounting entries posted yet.")}</p>
        ) : (
          <div className="space-y-3">
            {data.drCrEntries.map((e: any) => (
              <div key={e.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs">
                  <Link
                    href={`/dashboard/roznamcha/super-admin?entry=${e.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {e.journalNo || e.id.slice(0, 8)}
                  </Link>
                  <span className="text-slate-500">
                    {dt(e.entryDate)} · {s.t(`rzstatus_${e.status}`, e.status)}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {e.lines.map((rl: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1">{rl.ledgerCode ? `${rl.ledgerCode} — ` : ""}{rl.ledgerName || rl.description || "—"}</td>
                        <td className={s.textEnd + " tabular-nums text-emerald-600"}>{rl.debit ? fmt(rl.debit) : ""}</td>
                        <td className={s.textEnd + " tabular-nums text-rose-600"}>{rl.credit ? fmt(rl.credit) : ""}</td>
                        <td className={s.textEnd + " text-slate-400"}>{rl.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n={7} icon={Layers} title={s.t("dd_s_cost", "Total Expense · Landed / Final Cost")}>
        <Row k={s.t("dd_original_cost", "Original Bill (Functional)")} v={`${fc} ${fmt(data.cost.originalBillFunctional)}`} />
        <Row k={s.t("dd_expense_total", "Posted Expense Total")} v={`${fc} ${fmt(data.cost.postedExpenseTotal)}`} />
        <Row k={s.t("dd_landed_cost", "Landed / Final Cost")} v={<strong>{fc} {fmt(data.cost.landedCost)}</strong>} />
        <Row k={s.t("dd_unit_landed", "Unit Landed Cost")} v={`${fc} ${fmt(data.cost.unitLandedCost)}`} />
      </Section>

      <Section n={8} icon={TrendingUp} title={s.t("dd_s_qty", "Purchased · Sold · Remaining Qty & Value")}>
        <Row k={s.t("dd_qty_purchased", "Qty Purchased")} v={qtyFmt(data.quantity.purchased)} />
        <Row k={s.t("dd_qty_sold", "Qty Sold")} v={qtyFmt(data.quantity.sold)} />
        <Row k={s.t("dd_qty_remaining", "Qty Remaining")} v={qtyFmt(data.quantity.remaining)} />
        <Row k={s.t("dd_remaining_value", "Remaining Value")} v={`${fc} ${fmt(data.quantity.remainingValue)}`} />
      </Section>

      <Section n={9} icon={Receipt} title={s.t("dd_s_sales", "Related Sales & Revenue")}>
        {data.relatedSales.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_sales", "No linked sales orders.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className={s.textStart + " py-1"}>{s.t("dd_so_no", "Sales Order")}</th>
                  <th className={s.textStart}>{s.t("dd_so_customer", "Customer")}</th>
                  <th className={s.textStart}>{s.t("dd_so_date", "Date")}</th>
                  <th className={s.textEnd}>{s.t("dd_so_qty", "Qty")}</th>
                  <th className={s.textEnd}>{s.t("dd_so_revenue", "Revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.relatedSales.map((so: any) => (
                  <tr key={so.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1">{so.salesOrderNo}</td>
                    <td>{so.customerName || "—"}</td>
                    <td>{dt(so.orderDate)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{qtyFmt(so.quantity)}</td>
                    <td className={s.textEnd + " tabular-nums"}>{money(so.revenue)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={4} className={s.textEnd + " py-1.5"}>{s.t("dd_revenue", "Revenue")}</td>
                  <td className={s.textEnd + " tabular-nums"}>{fc} {fmt(pnl.revenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={10} icon={profitPositive ? TrendingUp : TrendingDown} title={s.t("dd_s_pnl", "Profit / Loss")}>
        <Row k={s.t("dd_revenue", "Revenue")} v={`${fc} ${fmt(pnl.revenue)}`} />
        <Row k={s.t("dd_cost_of_sold", "Cost of Sold Qty")} v={`${fc} ${fmt(pnl.costOfSold)}`} />
        <Row k={s.t("dd_landed_cost", "Landed / Final Cost")} v={`${fc} ${fmt(pnl.landedCost)}`} />
        <Row
          k={s.t("dd_profit", "Profit / Loss")}
          v={
            pnl.profit == null ? (
              <span className="text-slate-400">{s.t("dd_profit_na", "Not computable — no linked sale")}</span>
            ) : (
              <strong className={profitPositive ? "text-emerald-600" : "text-rose-600"}>
                {fc} {fmt(pnl.profit)}
              </strong>
            )
          }
        />
        {pnl.basis && <p className="mt-2 text-xs text-slate-400">{s.t(`pnl_basis_${pnl.basis}`, pnl.basis)}</p>}
      </Section>

      <Section n={11} icon={ScrollText} title={s.t("dd_s_documents", "Documents")}>
        {data.documents.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_documents", "No documents attached.")}</p>
        ) : (
          <ul className="space-y-1">
            {data.documents.map((d: any) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span>{d.name}</span>
                <span className="text-slate-400">· {d.mimeType || "—"} · {dt(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n={12} icon={History} title={s.t("dd_s_audit", "Audit Trail")}>
        {data.audit.length === 0 ? (
          <p className="text-slate-500">{s.t("dd_no_audit", "No audit records.")}</p>
        ) : (
          <ul className="space-y-1">
            {data.audit.map((a: any) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{a.action}</span>
                <span className="text-slate-400">{a.entityTable}</span>
                <span className="text-slate-400">· {a.actorName || "—"} · {new Date(a.createdAt).toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </section>
  );
}
