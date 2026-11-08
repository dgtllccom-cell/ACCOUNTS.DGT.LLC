"use client";

import { PaymentSummaryStrip } from "@/features/journal/components/payment-summary-strip";
import { PurchaseInvoiceSummaryPanel } from "./purchase-invoice-summary";
import type { PurchaseInvoiceSummary } from "@/lib/journal/purchase-invoice-summary";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers,
  Pencil,
  Pin,
  Plus,
  Printer,
  Save,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type UiKey } from "@/lib/i18n/ui";
import { paymentSummaryFigures } from "@/lib/journal/purchase-payment-entry-model";
import type { EntryModel, PaymentEntryMode, PaymentLimit } from "@/lib/journal/purchase-payment-entry-model";

/**
 * The Endorsement / Advance / Remaining payment entry as ONE full-width document (replaces the register while an order is open).
 * Presentational only: the figures come from lib/journal/purchase-payment-entry-model.ts and the actions are the journal's existing handlers
 * (save → the same double-entry POST, print → the same A4 PDF, edit → the same PaymentEditModal). The existing entry form is portaled into
 * #ppe-entry-slot, so posting behaves exactly as before.
 */

/**
 * The payment function stores every payment in the branch currency (a USD 23,250 payment is saved as AED 85,327.50 with the rate), so the stored
 * "amount" is already the local figure. The table shows the amount in the BILL's currency (computed by the journal as amtUSD) beside the rate, and
 * the local figure under "Final Amount" - never the same AED number twice.
 */
const billAmountOf = (x: { amtUSD?: number; amount?: number }) =>
  Number.isFinite(Number(x.amtUSD)) && Number(x.amtUSD) > 0 ? Number(x.amtUSD) : Number(x.amount);
const billCurrencyOf = (x: { amtUSD?: number; currency_code?: string | null }, purchaseCcy?: string | null) =>
  Number.isFinite(Number(x.amtUSD)) && Number(x.amtUSD) > 0 && purchaseCcy ? purchaseCcy : x.currency_code;

export type EntryPaymentRow = {
  id: string;
  kind: string;
  entry_date?: string | null;
  created_at?: string | null;
  amount: number;
  currency_code?: string | null;
  exchange_rate?: number | null;
  reference_no?: string | null;
  narration?: string | null;
  status?: string | null;
  posted_to_journal?: boolean | null;
  journal_posted_at?: string | null;
  debit_ledger_id?: string | null;
  credit_ledger_id?: string | null;
  loading_record_id?: string | null;
  roznamcha_entries?: { super_admin_serial_number?: string | null; profiles?: { full_name?: string | null } | null } | null;
  /** amount in the purchase currency / in the local currency (computed by the journal) */
  amtUSD: number;
  amtAED: number;
  paymentNo: number;
};

export type PaymentEntryDocumentProps = {
  lang: string;
  isRtl: boolean;
  mode: PaymentEntryMode;
  model: EntryModel;
  invoiceSummary?: PurchaseInvoiceSummary;
  limit: PaymentLimit | null;
  purchaseCurrency: string;
  baseCurrency: string;
  rate: number;
  percent: number;
  endorsementOrder: boolean;
  orderNo: string;
  branchName: string;
  countryName: string;
  purchaseAccount: string;
  paymentDate: string;
  /** Saved selected loading; absent for Advance or Local Purchase. */
  batch?: {
    loadingNo: string;
    quantity: number;
    netKg: number | null;
    value: number;
    advanceAllocated: number;
    outstanding: number;
  } | null;
  supplier: { accountNo: string; name: string; country: string; contact: string };
  contract: { no: string; date: string; goods: string; origin: string };
  payments: EntryPaymentRow[];
  ledgerLabel: (id?: string | null) => string;
  saving: boolean;
  saveDisabled: boolean;
  /** the saved payment rows are still being fetched */
  paymentsLoading?: boolean;
  onBack: () => void;
  onPrint: () => void;
  onSave: () => void;
  onNewPayment: () => void;
  onEdit: (payment: EntryPaymentRow) => void;
  /** tells the journal whether the typed amount is over the remaining balance (it then disables its own submit button) */
  onLimitChange: (over: boolean) => void;
};

const fmt = (v: unknown, digits = 2) =>
  Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const day = (v?: string | null) => (v ? String(v).slice(0, 10).split("-").reverse().join("-") : "—");
const dash = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? "—" : String(v));

function InfoCard({ tone, icon, title, children }: { tone: "blue" | "green" | "orange" | "violet"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const head = {
    blue: "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200",
    green: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    orange: "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
    violet: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
  }[tone];
  const chip = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    orange: "bg-orange-500",
    violet: "bg-violet-600"
  }[tone];
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <header className={cn("flex items-center gap-2.5 px-3.5 py-2.5", head)}>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-white", chip)}>{icon}</span>
        <h3 className="text-sm font-extrabold">{title}</h3>
      </header>
      <dl className="divide-y divide-slate-100 px-3.5 py-1 text-xs dark:divide-slate-800">{children}</dl>
    </section>
  );
}

function Row({ label, children, strong, tone }: { label: string; children: React.ReactNode; strong?: boolean; tone?: "red" | "green" }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words text-end font-semibold text-slate-800 dark:text-slate-100",
          strong && "font-extrabold",
          tone === "red" && "text-rose-600 dark:text-rose-400",
          tone === "green" && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function PurchasePaymentEntryDocument(p: PaymentEntryDocumentProps) {
  const tt = (key: string, fallback: string) => t(p.lang, `ppe.${key}` as UiKey, fallback);
  const [crPayment, setCrPayment] = useState<EntryPaymentRow | null>(null);

  useEffect(() => {
    if (!crPayment) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCrPayment(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [crPayment]);

  const over = Boolean(p.limit?.over);
  const { onLimitChange } = p;
  useEffect(() => {
    onLimitChange(over);
    return () => onLimitChange(false);
  }, [over, onLimitChange]);

  const m = p.model;
  const title = tt(`title_${p.mode}`, p.mode === "endorsement" ? "Endorsement Payment Entry" : p.mode === "advance" ? "Advance Payment Entry" : "Remaining Payment Entry");
  const stageKey = p.mode === "endorsement" ? "col_stage_endorsement" : p.mode === "advance" ? "col_stage_advance" : "col_stage_remaining";
  const stageLabel = tt(stageKey, p.mode === "remaining" ? "Remaining Amount" : p.mode === "advance" ? "Advance Amount" : "Endorsement Amount");
  const statusCls = { draft: "bg-amber-100 text-amber-800 border-amber-300", partial: "bg-blue-100 text-blue-800 border-blue-300", paid: "bg-emerald-100 text-emerald-800 border-emerald-300" }[m.status];
  const statusText = tt(`status_${m.status}`, m.status === "draft" ? "Draft" : m.status === "partial" ? "Partly paid" : "Fully paid");

  // the entries the current stage is about: endorsement/advance → advance-kind payments, remaining → remaining-kind payments
  const dateOf = (x: EntryPaymentRow) => String(x.entry_date || x.created_at || "");
  const shown = [...(p.mode === "remaining" ? p.payments.filter(payment => payment.kind === "remaining") : p.payments)].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const remainingAfter = new Map(m.breakdown.map((b) => [b.id, b.remainingAfter]));
  const invoicePayment = new Map(p.invoiceSummary?.payments.map(payment => [payment.id, payment]));
  const invoiceRemainingAfter = new Map<string, number | null>();
  let invoiceRunning = p.invoiceSummary?.invoice.purchase ?? null;
  for (const payment of p.invoiceSummary?.payments ?? []) {
    invoiceRunning = invoiceRunning == null || payment.purchase == null ? null : Math.max(0, invoiceRunning - payment.purchase);
    invoiceRemainingAfter.set(payment.id, invoiceRunning);
  }
  const invoiceFmt = (value: number | null | undefined, digits = 2) => value == null ? "—" : fmt(value, digits);
  const figures = paymentSummaryFigures(m, p.percent, p.rate);
  const shownTotals = shown.reduce((a, x) => ({ po: a.po + x.amtUSD, local: a.local + x.amtAED }), { po: 0, local: 0 });
  const entriesTitle = tt("breakdown_title", "Payment breakdown");
  const kindOf = (x: EntryPaymentRow) => {
    if (x.kind === "remaining") return tt("kind_remaining", "Remaining");
    if (x.kind === "credit") return tt("kind_credit", "Credit");
    const a = m.allocations[x.id];
    if (a && a.endorsement > 0 && a.advance > 0) return `${tt("kind_endorsement", "Endorsement")} / ${tt("kind_advance", "Advance")}`;
    if (a && a.endorsement > 0) return tt("kind_endorsement", "Endorsement");
    return tt("kind_advance", "Advance");
  };

  const cr = crPayment;
  const crRelated = cr ? p.ledgerLabel(cr.credit_ledger_id) : "";

  const th = "max-w-[100px] border-b border-slate-200 bg-slate-100 px-2 py-2 text-center align-middle text-[11px] font-bold leading-tight text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  const td = "whitespace-nowrap border-b border-slate-100 px-2 py-2 text-center text-xs text-slate-800 dark:border-slate-800 dark:text-slate-100";
  const num = "tabular-nums";

  return (
    <div data-testid="payment-entry-document" className="w-full space-y-4 p-3 sm:p-4" dir={p.isRtl ? "rtl" : "ltr"}>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h1>
          <nav aria-label="Breadcrumb" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <span>{t(p.lang, "nav.dashboard", "Dashboard")}</span>
            <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden />
            <span>{tt("crumb_payments", "Payments")}</span>
            <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden />
            <span className="font-semibold text-blue-700 dark:text-blue-400">{title}</span>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="ppe-status" className={cn("rounded-md border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide", statusCls)}>{statusText}</span>
          <button type="button" data-testid="ppe-back" onClick={p.onBack} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700">
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            {tt("btn_back", "Back to Register")}
          </button>
          <button type="button" data-testid="ppe-print" onClick={p.onPrint} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <Printer className="h-3.5 w-3.5" aria-hidden />
            {tt("btn_print", "Print")}
          </button>
          <button type="button" data-testid="ppe-save" onClick={p.onSave} disabled={p.saving || p.saveDisabled} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-3.5 w-3.5" aria-hidden />
            {tt("btn_save", "Save")}
          </button>
        </div>
      </div>

      {p.mode === "remaining" && p.batch && (
        <section data-testid="ppe-selected-loading-summary" className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 shadow-xs dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-800 dark:text-slate-100">
            <span className="font-extrabold text-blue-800 dark:text-blue-200">{translateHeader(p.lang, "Loading No")}: <b dir="ltr">{p.batch.loadingNo}</b></span>
            <span>{translateHeader(p.lang, "Total Quantity")}: <b dir="ltr">{fmt(p.batch.quantity, 0)}</b></span>
            <span>{translateHeader(p.lang, "Net Weight")}: <b dir="ltr">{p.batch.netKg == null ? "—" : fmt(p.batch.netKg, 0)} KG</b></span>
            <span>{translateHeader(p.lang, "Bill Total")}: <b dir="ltr">{fmt(p.batch.value)} {p.purchaseCurrency}</b></span>
            <span>{translateHeader(p.lang, "Advance Amount")}: <b dir="ltr">{fmt(p.batch.advanceAllocated)} {p.purchaseCurrency}</b></span>
            <span className="font-extrabold text-rose-700 dark:text-rose-300">{translateHeader(p.lang, "Remaining Balance")}: <b dir="ltr">{fmt(p.batch.outstanding)} {p.purchaseCurrency}</b></span>
          </div>
        </section>
      )}

      {/* compact payment summary: calculated advance vs paid vs outstanding, from the saved payment records */}
      {p.invoiceSummary
        ? <PurchaseInvoiceSummaryPanel lang={p.lang} summary={p.invoiceSummary} loading={p.paymentsLoading} />
        : <PaymentSummaryStrip lang={p.lang} currency={p.purchaseCurrency} localCurrency={p.baseCurrency} figures={figures} loading={p.paymentsLoading} />}

      {/* payment breakdown: every saved payment in date order with the balance left after it */}
      <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-xs dark:border-rose-900/60 dark:bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 px-4 py-3 dark:bg-rose-950/30">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-rose-900 dark:text-rose-200">
            <Wallet className="h-5 w-5" aria-hidden />
            {entriesTitle}
          </h2>
          <button type="button" data-testid="ppe-new-payment" onClick={p.onNewPayment} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700">
            <Plus className="h-4 w-4" aria-hidden />
            {tt("btn_new_payment", "New Payment")}
          </button>
        </header>
        <div className="overflow-x-auto">
          <table data-no-cards className="w-full min-w-[960px] border-collapse [&_td]:!px-1.5 [&_th]:!px-1.5">
            <thead>
              <tr>
                <th scope="col" className={th}>#</th>
                <th scope="col" className={th}>{tt("col_date", "Date")}</th>
                <th scope="col" className={th}>{tt("col_user", "User Name")}</th>
                <th scope="col" className={th}>{tt("col_roznamcha_type", "Roznamcha Type")}</th>
                <th scope="col" className={th}>{tt("col_roznamcha_no", "Roznamcha No.")}</th>
                <th scope="col" className={th}>{tt("col_type", "Type")}</th>
                <th scope="col" className={cn(th, "text-start")}>{tt("col_details", "Details")}</th>
                <th scope="col" className={th}>{tt("col_currency", "Currency")}</th>
                <th scope="col" className={th}>{tt("col_amount", "Amount")}</th>
                <th scope="col" className={th}>{tt("col_exchange_rate", "Exchange Rate")}</th>
                <th scope="col" className={th}>{tt("col_final_local", "Final Amount (local)")}</th>
                <th scope="col" className={th}>{tt("col_remaining_after", "Remaining after payment")}<span className="block text-[10px] font-semibold text-slate-500" dir="ltr">({p.purchaseCurrency})</span></th>
                <th scope="col" className={th}>{tt("col_cr_details", "CR Details")}</th>
                <th scope="col" className={th}>{tt("col_action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={14} className={cn(td, "py-6 text-slate-500")}>{tt("no_payments", "No payments recorded for this order yet.")}</td></tr>
              )}
              {shown.map((x, i) => (
                <tr key={x.id} data-testid="ppe-payment-row" className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/60">
                  <td className={td}>{i + 1}</td>
                  <td className={td}><span dir="ltr">{day(x.entry_date || x.created_at)}</span></td>
                  <td className={td}>{dash(x.roznamcha_entries?.profiles?.full_name)}</td>
                  <td className={cn(td, "max-w-[90px] truncate")} title={p.ledgerLabel(x.credit_ledger_id)}>{dash(p.ledgerLabel(x.credit_ledger_id))}</td>
                  <td className={cn(td, "max-w-[100px] truncate")} title={String(x.reference_no || x.roznamcha_entries?.super_admin_serial_number || "")}><span dir="ltr">{dash(x.reference_no || x.roznamcha_entries?.super_admin_serial_number)}</span></td>
                  <td className={td}>{kindOf(x)}</td>
                  <td className={cn(td, "max-w-[80px] truncate text-start")} title={x.narration || ""}>{dash(x.narration)}</td>
                  <td className={td}>{p.invoiceSummary ? dash(p.invoiceSummary.purchaseCurrency) : dash(billCurrencyOf(x, p.purchaseCurrency))}</td>
                  <td className={cn(td, num)} dir="ltr">{p.invoiceSummary ? invoiceFmt(invoicePayment.get(x.id)?.purchase) : fmt(billAmountOf(x))}</td>
                  <td className={cn(td, num)} dir="ltr">{p.invoiceSummary ? invoiceFmt(invoicePayment.get(x.id)?.rate, 4) : fmt(x.exchange_rate, 4)}</td>
                  <td className={cn(td, num, "font-bold")} dir="ltr">{p.invoiceSummary ? invoiceFmt(invoicePayment.get(x.id)?.final) : fmt(x.amtAED)}</td>
                  <td className={cn(td, num, "font-bold text-rose-700 dark:text-rose-300")} dir="ltr" data-testid="ppe-remaining-after">{p.invoiceSummary ? invoiceFmt(invoiceRemainingAfter.get(x.id)) : fmt(remainingAfter.get(x.id) ?? m.balance)}</td>
                  <td className={td}>
                    <button type="button" data-testid="ppe-cr-details" onClick={() => setCrPayment(x)} className="inline-grid h-8 w-8 place-items-center rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40" title={tt("view_cr", "View CR / DR details")} aria-label={tt("view_cr", "View CR / DR details")}>
                      <Pin className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                  <td className={td}>
                    <button type="button" data-testid="ppe-edit" onClick={() => p.onEdit(x)} className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                      <Pencil className="h-3 w-3" aria-hidden />
                      {tt("btn_edit", "Edit")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {shown.length > 0 && (
              <tfoot>
                <tr className="bg-rose-50 font-extrabold text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  <td className={td} colSpan={8}>{tt("col_total", "Total")}</td>
                  <td className={cn(td, num)} dir="ltr">{p.invoiceSummary ? invoiceFmt(p.invoiceSummary.paid.purchase) : fmt(shownTotals.po)} <span className="text-[10px] font-semibold">{p.purchaseCurrency}</span></td>
                  <td className={td}>—</td>
                  <td className={cn(td, num)} dir="ltr">{p.invoiceSummary ? invoiceFmt(p.invoiceSummary.paid.final) : fmt(shownTotals.local)} <span className="text-[10px] font-semibold">{p.invoiceSummary?.finalCurrency || p.baseCurrency}</span></td>
                  <td className={cn(td, num)} dir="ltr">{p.invoiceSummary ? invoiceFmt(p.invoiceSummary.remaining.purchase) : fmt(m.balance)} <span className="text-[10px] font-semibold">{p.purchaseCurrency}</span></td>
                  <td className={td} colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>


      {/* four info cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard tone="blue" icon={<FileText className="h-4 w-4" />} title={tt("card_payment_info", "Payment Info")}>
          <Row label={tt("f_payment_no", "Payment No.")}><span dir="ltr">{p.orderNo}</span></Row>
          <Row label={tt("f_purchase_account", "Purchase Account")}>{dash(p.purchaseAccount)}</Row>
          <Row label={tt("f_location", "Location")}>{dash(p.countryName)}</Row>
          <Row label={tt("f_branch", "Branch")}>{dash(p.branchName)}</Row>
          <Row label={tt("f_payment_date", "Payment Date")}><span dir="ltr">{day(p.paymentDate)}</span></Row>
        </InfoCard>

        <InfoCard tone="orange" icon={<UserRound className="h-4 w-4" />} title={tt("card_supplier", "Supplier Details")}>
          <Row label={tt("f_account_no", "Account No.")}><span dir="ltr">{dash(p.supplier.accountNo)}</span></Row>
          <Row label={tt("f_supplier_name", "Supplier Name")}>{dash(p.supplier.name)}</Row>
          <Row label={tt("f_country", "Country")}>{dash(p.supplier.country)}</Row>
          <Row label={tt("f_contact", "Contact")}><span dir="ltr">{dash(p.supplier.contact)}</span></Row>
        </InfoCard>

        <InfoCard tone="violet" icon={<Building2 className="h-4 w-4" />} title={tt("card_contract", "Contract Details")}>
          <Row label={tt("f_contract_no", "Contract No.")}><span dir="ltr">{dash(p.contract.no)}</span></Row>
          <Row label={tt("f_contract_date", "Contract Date")}><span dir="ltr">{day(p.contract.date)}</span></Row>
          <Row label={tt("f_goods", "Goods")}>{dash(p.contract.goods)}</Row>
          <Row label={tt("f_origin", "Origin")}>{dash(p.contract.origin)}</Row>
          <Row label={tt("f_currency", "Currency")}>{p.purchaseCurrency}</Row>
          <Row label={tt("f_exchange_rate", "Exchange Rate")}><span dir="ltr" className={num}>{fmt(p.rate, 4)}</span></Row>
        </InfoCard>
      </div>

      {/* payment limit */}
      {p.limit && (
        <div
          data-testid="ppe-limit"
          role={p.limit.over ? "alert" : undefined}
          className={cn(
            "flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border px-4 py-2.5 text-xs",
            p.limit.over || m.balance <= 0.01
              ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
          )}
        >
          {p.limit.over || m.balance <= 0.01 ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />}
          <span>
            {tt("limit_max", "Maximum payable now")}: <strong dir="ltr" className={num}>{fmt(p.limit.maxPayable)} {p.purchaseCurrency}</strong>
            {m.goodsTotals.amount > 0 && <span className="text-slate-500"> ({fmt(m.goodsTotals.amount > 0 ? (p.limit.maxPayable / m.goodsTotals.amount) * 100 : 0, 1)}% {tt("limit_of_contract", "of the contract")})</span>}
          </span>
          <span>{tt("paid_of_contract", "Paid so far")}: <strong dir="ltr" className={num}>{fmt(m.paidPercent, 1)}%</strong></span>
          {p.endorsementOrder && m.stillRequired > 0.01 && (
            <span>{tt("still_required", "Still required")} ({tt("required_endorsement", "Required endorsement")}): <strong dir="ltr" className={num}>{fmt(m.stillRequired)} {p.purchaseCurrency}</strong></span>
          )}
          {m.balance <= 0.01 ? (
            <strong>{tt("limit_fully_paid", "This order is fully paid — no further payment can be recorded.")}</strong>
          ) : p.limit.over ? (
            <strong data-testid="ppe-over">{tt("limit_over", "This amount is more than the remaining balance. Reduce it to the maximum shown.")}</strong>
          ) : null}
        </div>
      )}

      {/* goods */}
      <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-xs dark:border-emerald-900/60 dark:bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/40">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-emerald-900 dark:text-emerald-200">
            <Layers className="h-5 w-5" aria-hidden />
            {tt(`goods_title_${p.mode}`, "Goods Details")}
            <span dir="ltr" className="text-sm font-bold">({fmt(m.stagePercent, m.stagePercent % 1 ? 2 : 0)}%)</span>
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table data-no-cards className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={th}>#</th>
                <th scope="col" className={cn(th, "text-start")}>{tt("col_goods_name", "Goods Name")}</th>
                <th scope="col" className={th}>{tt("col_hs_code", "HS Code")}</th>
                <th scope="col" className={th}>{tt("col_qty", "Qty")}</th>
                <th scope="col" className={th}>{tt("col_net_weight", "Net Weight (KG)")}</th>
                <th scope="col" className={th}>{tt("col_purchase_amount", "Purchase Amount")}<span className="block text-[10px] font-semibold text-slate-500" dir="ltr">({p.purchaseCurrency})</span></th>
                <th scope="col" className={th}>{tt("col_exchange_rate", "Exchange Rate")}</th>
                <th scope="col" className={th}>{tt("col_final_amount", "Final Amount")}<span className="block text-[10px] font-semibold text-slate-500" dir="ltr">({p.baseCurrency})</span></th>
                <th scope="col" className={th}>{tt("col_pct", "Share %")}</th>
                <th scope="col" className={th}>{stageLabel}<span className="block text-[10px] font-semibold text-slate-500" dir="ltr">({p.purchaseCurrency})</span></th>
                <th scope="col" className={th}>{stageLabel}<span className="block text-[10px] font-semibold text-slate-500" dir="ltr">({p.baseCurrency})</span></th>
              </tr>
            </thead>
            <tbody>
              {m.goods.length === 0 && (
                <tr><td colSpan={11} className={cn(td, "py-6 text-slate-500")}>—</td></tr>
              )}
              {m.goods.map((g, i) => (
                <tr key={`${g.name}-${i}`} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/60">
                  <td className={td}>{i + 1}</td>
                  <td className={cn(td, "text-start font-semibold")}>{dash(g.name)}</td>
                  <td className={td}><span dir="ltr">{dash(g.hsCode)}</span></td>
                  <td className={cn(td, num)} dir="ltr">{fmt(g.qty, 0)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(g.netKg, 0)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(g.amount)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(g.rate, 4)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(g.finalAmount)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.stagePercent, m.stagePercent % 1 ? 2 : 0)}%</td>
                  <td className={cn(td, num, "font-bold")} dir="ltr">{fmt(g.stageAmount)}</td>
                  <td className={cn(td, num, "font-bold")} dir="ltr">{fmt(g.stageFinal)}</td>
                </tr>
              ))}
            </tbody>
            {m.goods.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50 font-extrabold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <td className={td} colSpan={3}>{tt("col_total", "Total")}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.qty, 0)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.netKg, 0)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.amount)}</td>
                  <td className={td}>—</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.finalAmount)}</td>
                  <td className={td}>—</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.stageAmount)}</td>
                  <td className={cn(td, num)} dir="ltr">{fmt(m.goodsTotals.stageFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* the existing entry form + container selection are portaled in here */}
      <section id="ppe-container-slot" className="empty:hidden" />
      <section id="ppe-entry-slot" data-testid="ppe-entry-slot" aria-label={tt("entry_section", "New payment entry")} className="scroll-mt-20" />

      {/* Centered CR / DR details: wide desktop cards, stacked mobile content. */}
      {cr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={tt("drawer_title", "CR / DR Details")} data-testid="ppe-drawer">
          <button type="button" className="absolute inset-0 cursor-default bg-slate-900/40" aria-label={tt("d_close", "Close")} onClick={() => setCrPayment(null)} />
          <aside className="relative z-10 flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800">
              <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl dark:text-white">{tt("drawer_title", "CR / DR Details")}</h2>
              <button type="button" onClick={() => setCrPayment(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={tt("d_close", "Close")}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="grid min-h-0 auto-rows-max gap-4 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:grid-cols-2 [&_dl]:text-sm [&_dt]:max-w-[42%] [&_dd]:[overflow-wrap:anywhere]">
              <InfoCard tone="blue" icon={<FileText className="h-4 w-4" />} title={tt("drawer_selected_dr", "Selected Payment (DR)")}>
                <Row label={tt("f_payment_no", "Payment No.")}><span dir="ltr">{dash(cr.reference_no || `${p.orderNo}-${String(cr.paymentNo).padStart(2, "0")}`)}</span></Row>
                <Row label={tt("col_date", "Date")}><span dir="ltr">{day(cr.entry_date || cr.created_at)}</span></Row>
                <Row label={`${tt("col_amount", "Amount")} (${dash(cr.currency_code)})`}><span dir="ltr" className={num}>{fmt(cr.amount)}</span></Row>
                <Row label={tt("f_exchange_rate", "Exchange Rate")}><span dir="ltr" className={num}>{fmt(cr.exchange_rate, 4)}</span></Row>
                <Row label={`${tt("col_final_amount", "Final Amount")} (${p.baseCurrency})`} strong><span dir="ltr" className={num}>{fmt(cr.amtAED)}</span></Row>
                <Row label={tt("col_type", "Type")}>{kindOf(cr)}</Row>
                <Row label={tt("d_dr_account", "Debit Account")}>{dash(p.ledgerLabel(cr.debit_ledger_id))}</Row>
              </InfoCard>
              <InfoCard tone="violet" icon={<Wallet className="h-4 w-4" />} title={tt("drawer_related_cr", "Related Credit (CR) Details")}>
                <Row label={tt("d_voucher", "Voucher No.")}><span dir="ltr">{dash(cr.reference_no || cr.roznamcha_entries?.super_admin_serial_number)}</span></Row>
                <Row label={tt("col_date", "Date")}><span dir="ltr">{day(cr.entry_date || cr.created_at)}</span></Row>
                <Row label={`${tt("col_amount", "Amount")} (${p.purchaseCurrency})`}><span dir="ltr" className={num}>{fmt(cr.amtUSD)}</span></Row>
                <Row label={`${tt("col_final_amount", "Final Amount")} (${p.baseCurrency})`}><span dir="ltr" className={num}>{fmt(cr.amtAED)}</span></Row>
                <Row label={tt("d_cr_account", "Credit Account")}>{dash(crRelated)}</Row>
                <Row label={tt("d_narration", "Narration")}>{dash(cr.narration)}</Row>
              </InfoCard>
              <div className="lg:col-span-2">
                <InfoCard tone="green" icon={<Layers className="h-4 w-4" />} title={tt("drawer_transfer", "Transfer Details (if any)")}>
                  {cr.loading_record_id ? (
                    <>
                      <Row label={tt("d_transferred_to", "Transferred To")}>{tt("container_section", "Loading / container")}</Row>
                      <Row label={tt("d_document_no", "Document No.")}><span dir="ltr">{String(cr.loading_record_id).slice(0, 8).toUpperCase()}</span></Row>
                      <Row label={tt("d_transfer_date", "Transfer Date")}><span dir="ltr">{day(cr.journal_posted_at || cr.entry_date)}</span></Row>
                      <Row label={tt("d_status", "Status")} tone="green">{cr.posted_to_journal === false ? tt("d_pending", "Pending") : tt("d_posted", "Posted")}</Row>
                    </>
                  ) : (
                    <div className="py-3 text-xs text-slate-500">{tt("d_no_transfer", "Not transferred to Purchase Loading yet.")}</div>
                  )}
                </InfoCard>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
