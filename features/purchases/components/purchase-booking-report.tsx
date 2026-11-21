"use client";

/**
 * Purchase Booking Report — the booking shown as ONE report page (owner mock-up, 21 Nov 2026):
 *   top bar (breadcrumb + Save / View / Update / Next) · 5-step indicator ·
 *   Row 1: Branch & User | Bill Details | Purchase Account (Dr) | Sales Account (Cr)
 *   Row 2: Goods Details (rate shown WITH the bill's operator: "× 3.675" / "÷ 77.2")
 *   Row 3: Loading & Receiving | Payment Condition | Goods Quantity Summary
 *   Row 4: Journal Report / Narration
 *
 * Every value comes from the SAVED purchase_orders row via buildPurchaseBookingReport (lib/purchases/booking-report.ts);
 * nothing is invented — a missing value shows "—". Each remarks Save writes only that one form_data field through
 * PATCH /api/erp/purchases/orders/[id]. Posted / transferred bills are read-only (see bookingRemarksEditable).
 *
 * View opens the same report as a centred A4 page (A4DocumentViewer fit="page"); Print hands that page to the shared
 * print modal (printDomFragmentViaModal) in the active language with the right dir.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  Info,
  Landmark,
  Loader2,
  Package,
  Pin,
  Printer,
  RefreshCw,
  Save,
  Scale,
  Ship,
  User,
  Wallet,
} from "lucide-react";
import { A4DocumentViewer } from "@/components/ui/a4-document-viewer";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import {
  buildPurchaseBookingReport,
  remarkPatchBody,
  type BookingReportData,
  type BookingReportRemarkKind,
} from "@/lib/purchases/booking-report";

type AnyRec = Record<string, any>;
const RTL = new Set(["ur", "ar", "fa", "ps"]);
export const BOOKING_REPORT_PRINT_ID = "purchase-booking-report-a4";

const DASH = "—";
const fmt = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? DASH
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtQty = (n: number | null | undefined) =>
  n === null || n === undefined ? DASH : Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
const show = (v: string | null | undefined) => (v && String(v).trim() ? v : DASH);

function useLang(langProp?: string | null) {
  const active = useActiveLanguage();
  return (active !== "en" ? active : langProp || active) as string;
}

/* ---------------------------------------------------------------- small building blocks */

const TONES = {
  blue: { head: "bg-sky-50 text-sky-800 border-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900", icon: "bg-sky-600" },
  purple: { head: "bg-violet-50 text-violet-800 border-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900", icon: "bg-violet-600" },
  orange: { head: "bg-orange-50 text-orange-800 border-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900", icon: "bg-orange-500" },
  green: { head: "bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900", icon: "bg-emerald-600" },
} as const;
type Tone = keyof typeof TONES;

function Card({ tone, icon, title, extra, children, testId }: { tone: Tone; icon: React.ReactNode; title: string; extra?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section data-card="" data-testid={testId} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className={cn("flex items-center justify-between gap-2 border-b px-3 py-2", TONES[tone].head)}>
        <h3 className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-wider">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white", TONES[tone].icon)}>{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        {extra}
      </header>
      <div className="flex flex-1 flex-col gap-2 p-3">{children}</div>
    </section>
  );
}

/** label : value row — bold label, ":" aligned, value on the end side */
function Field({ label, value, mono, numeric, badge }: { label: string; value?: React.ReactNode; mono?: boolean; numeric?: boolean; badge?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,44%)_auto_minmax(0,1fr)] items-baseline gap-x-1.5 text-[11px] leading-5">
      <span className="min-w-0 break-words font-bold text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-bold text-slate-400">:</span>
      <span
        dir={mono || numeric ? "ltr" : undefined}
        className={cn(
          "min-w-0 break-words font-semibold text-slate-900 dark:text-slate-100",
          (mono || numeric) && "font-mono",
          numeric && "whitespace-nowrap text-end",
          badge && "flex",
        )}
      >
        {value === undefined || value === null || value === "" ? DASH : value}
      </span>
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "green" }) {
  const cls = tone === "blue" ? "bg-sky-100 text-sky-800" : tone === "green" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
  return <span dir="ltr" className={cn("ms-1 inline-flex rounded px-1.5 py-0 text-[10px] font-black", cls)}>{children}</span>;
}

function StatusBadge({ kind, label }: { kind: string; label: string }) {
  const cls =
    kind === "draft" || kind === "pending" || kind === "partial"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : kind === "posted" || kind === "completed"
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : kind === "transferred"
          ? "bg-sky-100 text-sky-800 border-sky-300"
          : kind === "cancelled"
            ? "bg-rose-100 text-rose-800 border-rose-300"
            : "bg-slate-100 text-slate-700 border-slate-300";
  return <span data-testid={`status-${kind}`} className={cn("inline-flex rounded-full border px-2 py-0 text-[10px] font-black uppercase tracking-wide", cls)}>{label}</span>;
}

/** a saved choice shown as a (read-only) select box — the report never changes the bill's terms */
function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div className="block space-y-0.5">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span
        data-select-like=""
        aria-label={label}
        className="flex min-h-7 w-full items-center justify-between gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold leading-normal text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <span className="min-w-0 break-words">{value || DASH}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- remarks */

type RemarkProps = {
  kind: BookingReportRemarkKind;
  label: string;
  value: string;
  document: boolean;
  editable: boolean;
  onSave?: (kind: BookingReportRemarkKind, value: string) => Promise<void>;
  lang: string;
  rows?: number;
};

function RemarkBox({ kind, label, value, document, editable, onSave, lang, rows = 2 }: RemarkProps) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => { setDraft(value); }, [value]);

  if (document) {
    return (
      <div className="mt-auto space-y-1 border-t border-dashed border-slate-200 pt-2">
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500"><Pin className="h-3 w-3" /> {label}</div>
        <p className="min-h-[1.25rem] whitespace-pre-wrap text-[11px] font-medium text-slate-800">{value || DASH}</p>
      </div>
    );
  }
  const dirty = draft !== value;
  return (
    <div className="mt-auto space-y-1 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
      <label htmlFor={`pbrep-remark-${kind}`} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
        <Pin className="h-3 w-3 text-rose-500" /> {label}
      </label>
      <textarea
        id={`pbrep-remark-${kind}`}
        data-testid={`remark-${kind}`}
        value={draft}
        rows={rows}
        disabled={!editable || state === "saving"}
        onChange={(e) => { setDraft(e.target.value); setState("idle"); }}
        placeholder={t(lang, "pbrep.remark_ph", "Type remarks here…")}
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/60 p-2 text-[11px] font-medium text-slate-900 outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="flex items-center justify-end gap-2">
        {state === "saved" && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {t(lang, "pbrep.remark_saved", "Saved")}</span>}
        {state === "error" && <span role="alert" className="text-[10px] font-bold text-rose-600">{t(lang, "pbrep.remark_save_failed", "Could not save. Please try again.")}</span>}
        <button
          type="button"
          data-testid={`remark-save-${kind}`}
          disabled={!editable || !dirty || state === "saving" || !onSave}
          onClick={async () => {
            if (!onSave) return;
            setState("saving");
            try { await onSave(kind, draft); setState("saved"); } catch { setState("error"); }
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-3 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {state === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {t(lang, "common.save", "Save")}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the report body (screen + A4) */

export interface PurchaseBookingReportBodyProps {
  data: BookingReportData;
  lang: string;
  /** "document" = the fixed A4 page (View / Print): fixed columns, remarks as text */
  mode?: "screen" | "document";
  onSaveRemark?: (kind: BookingReportRemarkKind, value: string) => Promise<void>;
}

export function PurchaseBookingReportBody({ data, lang, mode = "screen", onSaveRemark }: PurchaseBookingReportBodyProps) {
  const doc = mode === "document";
  const editable = !doc && !data.locked && Boolean(data.orderId) && Boolean(onSaveRemark);
  const cur = data.currency || DASH;
  const base = data.baseCurrency || DASH;
  const statusLabel = t(lang, `pbrep.status_${data.status}`, data.status.toUpperCase());
  const payStatus = data.payment.status || "pending";
  const remark = (kind: BookingReportRemarkKind, label: string, rows?: number) => (
    <RemarkBox kind={kind} label={label} value={data.remarks[kind]} document={doc} editable={editable} onSave={onSaveRemark} lang={lang} rows={rows} />
  );
  const accountCard = (kind: "purchase" | "sales") => {
    const a = kind === "purchase" ? data.purchaseAccount : data.salesAccount;
    return (
      <Card
        tone={kind === "purchase" ? "orange" : "green"}
        icon={kind === "purchase" ? <Landmark className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
        title={kind === "purchase" ? t(lang, "pbrep.purchase_account", "Purchase Account Details") : t(lang, "pbrep.sales_account", "Sales Account Details")}
        testId={`card-${kind}-account`}
        extra={
          <span className="flex items-center gap-1">
            <span className="rounded bg-white/70 px-1.5 text-[10px] font-black">{kind === "purchase" ? t(lang, "pbrep.dr", "Dr") : t(lang, "pbrep.cr", "Cr")}</span>
            <Info
              className="h-3.5 w-3.5 opacity-70"
              aria-label={kind === "purchase" ? t(lang, "pbrep.dr_hint", "Debited with the purchase value") : t(lang, "pbrep.cr_hint", "Credited — the supplier party")}
            >
              <title>{kind === "purchase" ? t(lang, "pbrep.dr_hint", "Debited with the purchase value") : t(lang, "pbrep.cr_hint", "Credited — the supplier party")}</title>
            </Info>
          </span>
        }
      >
        <Field label={t(lang, "pbrep.account_no", "Account No.")} value={a.code} mono />
        <Field label={t(lang, "pbrep.account_name", "Account Name")} value={a.name} />
        <Field label={t(lang, "pbrep.company", "Company")} value={a.company} />
      </Card>
    );
  };

  return (
    <div className={cn("space-y-3", doc && "text-slate-900")} data-testid="purchase-booking-report-body">
      {doc && (
        <div className="flex items-start justify-between gap-3 border-b-2 border-slate-800 pb-2">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wide">{t(lang, "pbrep.title", "Purchase Booking Report")}</h1>
            <p className="text-[11px] font-semibold text-slate-500">{show(data.branch.name)}</p>
          </div>
          <div className="text-end text-[11px]">
            <div className="font-mono text-sm font-black" dir="ltr">{show(data.bookingNo)}</div>
            <div className="font-semibold text-slate-500" dir="ltr">{show(data.bookingDate)}</div>
            <StatusBadge kind={data.status} label={statusLabel} />
          </div>
        </div>
      )}

      {/* Row 1 */}
      <div className={cn("grid gap-3", doc ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4")}>
        <Card tone="blue" icon={<Building2 className="h-3.5 w-3.5" />} title={t(lang, "pbrep.branch_user", "Branch & User Information")} testId="card-branch">
          <Field label={t(lang, "pbrep.branch_name", "Branch Name")} value={data.branch.name} />
          <Field label={t(lang, "pbrep.branch_code", "Branch Code")} value={data.branch.code} mono />
          <Field label={t(lang, "pbrep.branch_type", "Branch Type")} value={data.branch.type} />
          <Field label={t(lang, "pbrep.parent_branch", "Parent Branch")} value={data.branch.parent} />
          <Field label={t(lang, "pbrep.user_name", "User Name")} value={data.branch.userName} />
          <Field label={t(lang, "pbrep.user_role", "User Role")} value={data.branch.userRole} />
        </Card>

        <Card tone="purple" icon={<FileText className="h-3.5 w-3.5" />} title={t(lang, "pbrep.bill_details", "Bill Details")} testId="card-bill">
          <div className={cn("grid gap-3", doc ? "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : "grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
            <div className="space-y-1">
              <Field label={t(lang, "pbrep.booking_no", "Booking No.")} value={data.bookingNo} mono />
              <div className="grid grid-cols-[minmax(0,44%)_auto_minmax(0,1fr)] items-center gap-x-1.5 text-[11px]">
                <span className="min-w-0 break-words font-bold text-slate-600 dark:text-slate-400">{t(lang, "pbrep.booking_date", "Booking Date")}</span>
                <span className="font-bold text-slate-400">:</span>
                {doc ? (
                  <span className="font-mono font-semibold" dir="ltr">{show(data.bookingDate)}</span>
                ) : (
                  <input
                    type="date"
                    readOnly
                    value={data.bookingDate || ""}
                    aria-label={t(lang, "pbrep.booking_date", "Booking Date")}
                    className="h-6 w-full min-w-0 rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[11px] font-semibold dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
              </div>
              <Field label={t(lang, "pbrep.bill_no", "Purchase Bill No.")} value={data.billNo} mono />
              <Field label={t(lang, "pbrep.contract_no", "Contract No.")} value={data.contractNo} mono />
              <Field label={t(lang, "pbrep.pc_number", "PC Number")} value={data.pcNumber} mono />
              <Field label={t(lang, "pbrep.bill_status", "Bill Status")} value={<StatusBadge kind={data.status} label={statusLabel} />} badge />
            </div>
            <div className="space-y-2">
              <SelectLike label={t(lang, "pbrep.payment_type", "Payment Type")} value={data.paymentType} />
              <SelectLike label={t(lang, "pbrep.ship_type", "Ship Type")} value={data.shipType} />
              <SelectLike label={t(lang, "pbrep.loading_type", "Loading Type")} value={data.loadingType} />
            </div>
          </div>
        </Card>

        {accountCard("purchase")}
        {accountCard("sales")}
      </div>

      {/* Row 2: goods */}
      <section data-card="" data-testid="card-goods" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className={cn("flex items-center gap-2 border-b px-3 py-2 text-[11px] font-black uppercase tracking-wider", TONES.blue.head)}>
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-white", TONES.blue.icon)}><Package className="h-3.5 w-3.5" /></span>
          {t(lang, "pbrep.goods_details", "Goods Details")}
        </header>
        <div className={doc ? "" : "overflow-x-auto"}>
          <table className={cn("w-full border-collapse", doc ? "text-[9px] [&_td]:!px-1 [&_th]:!px-1 [&_th]:!text-[8px] [&_th]:leading-tight" : "min-w-[980px] text-[11px]")}>
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <th className="px-2 py-2 text-start">#</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_goods", "Goods Name")}</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_size", "Size")}</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_brand", "Brand")}</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_hs", "HS Code")}</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_origin", "Origin Country")}</th>
                <th className="px-2 py-2 text-end">{t(lang, "pbrep.col_qty", "Qty")}</th>
                <th className="px-2 py-2 text-start">{t(lang, "pbrep.col_unit", "Unit")}</th>
                <th className="px-2 py-2 text-end">{t(lang, "pbrep.col_price", "Price")} <span dir="ltr">({cur})</span></th>
                <th className="px-2 py-2 text-end">{t(lang, "pbrep.col_amount", "Amount")} <span dir="ltr">({cur})</span></th>
                <th className="px-2 py-2 text-end">{t(lang, "pbrep.col_rate", "Ex. Rate")}</th>
                <th className="px-2 py-2 text-end">{t(lang, "pbrep.col_final", "Final Amount")} <span dir="ltr">({base})</span></th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr><td colSpan={12} className="px-2 py-6 text-center font-semibold text-slate-500">{t(lang, "pbrep.no_goods", "No goods saved on this booking.")}</td></tr>
              ) : (
                data.lines.map((l) => (
                  <tr key={l.no} data-testid="goods-row" className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5 font-mono text-slate-500">{l.no}</td>
                    <td className="px-2 py-1.5 font-bold">{show(l.goodsName)}</td>
                    <td className="px-2 py-1.5">{show(l.size)}</td>
                    <td className="px-2 py-1.5">{show(l.brand)}</td>
                    <td className="px-2 py-1.5 font-mono" dir="ltr">{show(l.hsCode)}</td>
                    <td className="px-2 py-1.5">{show(l.origin)}</td>
                    <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmtQty(l.qty)}</td>
                    <td className="px-2 py-1.5">{show(l.unit)}</td>
                    <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmt(l.price)}</td>
                    <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmt(l.amount)}</td>
                    <td className="px-2 py-1.5 text-end font-mono font-bold text-violet-700" dir="ltr" data-testid="goods-rate">{l.rateLabel || DASH}</td>
                    <td className="px-2 py-1.5 text-end font-mono font-black" dir="ltr" data-testid="goods-final">{fmt(l.finalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.lines.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-black dark:bg-slate-800">
                  <td colSpan={6} className="px-2 py-1.5 text-end uppercase">{t(lang, "pbrep.total", "Total")}</td>
                  <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmtQty(data.totals.qty)}</td>
                  <td className="px-2 py-1.5">{show(data.totals.unit)}</td>
                  <td />
                  <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmt(data.totals.amount)}</td>
                  <td className="px-2 py-1.5 text-end font-mono text-violet-700" dir="ltr">{data.rateLabel || DASH}</td>
                  <td className="px-2 py-1.5 text-end font-mono" dir="ltr">{fmt(data.totals.finalAmount)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Row 3 */}
      <div className={cn("grid gap-3", doc ? "grid-cols-3" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
        <Card tone="blue" icon={<Ship className="h-3.5 w-3.5" />} title={t(lang, "pbrep.loading_receiving", "Loading & Receiving Details")} testId="card-loading">
          <div className={cn("grid gap-3", doc ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wide text-sky-700">{t(lang, "pbrep.loading_head", "Loading (Export / Import)")}</div>
              <Field label={t(lang, "pbrep.from_country", "From Country")} value={data.loading.fromCountry} />
              <Field label={t(lang, "pbrep.from_port", "From Port")} value={data.loading.fromPort} />
              <Field label={t(lang, "pbrep.loading_date", "Loading Date")} value={data.loading.date} mono />
              <Field label={t(lang, "pbrep.shipping_line", "Shipping Line")} value={data.loading.shippingLine} />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{t(lang, "pbrep.receiving_head", "Receiving (Import / Receiving)")}</div>
              <Field label={t(lang, "pbrep.to_country", "To Country")} value={data.receiving.toCountry} />
              <Field label={t(lang, "pbrep.to_port", "To Port")} value={data.receiving.toPort} />
              <Field label={t(lang, "pbrep.receiving_date", "Receiving Date")} value={data.receiving.date} mono />
              <Field label={t(lang, "pbrep.final_destination", "Final Destination")} value={data.receiving.finalDestination} />
              <Field label={t(lang, "pbrep.shipping_line", "Shipping Line")} value={data.receiving.shippingLine} />
            </div>
          </div>
          {remark("loading", t(lang, "pbrep.loading_remarks", "Loading Report / Remarks"))}
        </Card>

        <Card tone="purple" icon={<Wallet className="h-3.5 w-3.5" />} title={t(lang, "pbrep.payment_condition", "Payment Condition")} testId="card-payment">
          <Field label={t(lang, "pbrep.total_purchase", "Total Purchase Amount")} value={<>{fmt(data.totals.amount)}<Pill>{cur}</Pill></>} numeric />
          <Field label={t(lang, "pbrep.exchange_rate", "Exchange Rate")} value={<span data-testid="payment-rate">{data.rateLabel || DASH}</span>} numeric />
          <Field label={t(lang, "pbrep.final_amount", "Final Amount")} value={<><span data-testid="payment-final">{fmt(data.totals.finalAmount)}</span><Pill tone="blue">{base}</Pill></>} numeric />
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <Field
            label={`${t(lang, "pbrep.advance_payment", "Advance Payment")} ${data.payment.advancePercent !== null ? `(${data.payment.advancePercent}%)` : ""}`}
            value={<>{fmt(data.payment.advanceAmount)}<Pill>{cur}</Pill></>}
            numeric
          />
          <Field
            label={`${t(lang, "pbrep.advance_final", "Advance (Final)")} ${data.payment.advancePercent !== null ? `(${data.payment.advancePercent}%)` : ""}`}
            value={<>{fmt(data.payment.advanceFinal)}<Pill tone="blue">{base}</Pill></>}
            numeric
          />
          <Field label={t(lang, "pbrep.balance_amount", "Balance Amount")} value={<>{fmt(data.payment.balanceAmount)}<Pill>{cur}</Pill></>} numeric />
          <Field label={t(lang, "pbrep.balance_final", "Balance (Final)")} value={<>{fmt(data.payment.balanceFinal)}<Pill tone="blue">{base}</Pill></>} numeric />
          <Field label={t(lang, "pbrep.payment_status", "Payment Status")} value={<StatusBadge kind={payStatus} label={t(lang, `pbrep.pay_${payStatus}`, payStatus)} />} badge />
          {remark("payment", t(lang, "pbrep.payment_remarks", "Payment Report / Remarks"))}
        </Card>

        <Card tone="green" icon={<Scale className="h-3.5 w-3.5" />} title={t(lang, "pbrep.qty_summary", "Goods Quantity Summary")} testId="card-quantity">
          <Field label={t(lang, "pbrep.total_qty", "Total Quantity")} value={<>{fmtQty(data.totals.qty)}{data.totals.unit ? <Pill>{data.totals.unit}</Pill> : null}</>} numeric />
          <Field label={t(lang, "pbrep.total_gross", "Total Gross Weight (MT)")} value={fmt(data.totals.grossMt, 3)} numeric />
          <Field label={t(lang, "pbrep.total_net", "Total Net Weight (MT)")} value={fmt(data.totals.netMt, 3)} numeric />
          <div className="mt-1 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Field label={t(lang, "pbrep.total_amount", "Total Amount")} value={<>{fmt(data.totals.amount)}<Pill>{cur}</Pill></>} numeric />
            <Field label={t(lang, "pbrep.final_amount", "Final Amount")} value={<><span className="font-black">{fmt(data.totals.finalAmount)}</span><Pill tone="green">{base}</Pill></>} numeric />
          </div>
          {remark("quantity", t(lang, "pbrep.qty_remarks", "Quantity Report / Remarks"))}
        </Card>
      </div>

      {/* Row 4 */}
      <Card tone="orange" icon={<FileText className="h-3.5 w-3.5" />} title={t(lang, "pbrep.journal_narration", "Journal Report / Narration")} testId="card-journal">
        {remark("journal", t(lang, "pbrep.narration", "Narration"), 3)}
      </Card>

      {data.locked && data.orderId && !doc && (
        <p role="status" data-testid="report-locked-note" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-800">
          {t(lang, "pbrep.locked_note", "This bill is posted / transferred: the report is read-only. Remarks cannot be changed here because editing a posted bill reverses its posting.")}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- View (full-screen A4) */

export function PurchaseBookingReportViewer({ isOpen, onClose, data, lang: langProp }: { isOpen: boolean; onClose: () => void; data: BookingReportData; lang?: string }) {
  const lang = useLang(langProp);
  const title = `${t(lang, "pbrep.title", "Purchase Booking Report")}${data.bookingNo ? ` — ${data.bookingNo}` : ""}`;
  return (
    <A4DocumentViewer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={<FileText className="h-4 w-4 text-sky-600" />}
      fit="page"
      testId="purchase-booking-report-view"
      actions={
        <button
          type="button"
          data-testid="report-print"
          onClick={() => {
            void import("@/lib/reports/print-dom-fragment").then((m) => {
              if (!m.printDomFragmentViaModal(BOOKING_REPORT_PRINT_ID, title, { lang, orientation: "portrait" })) window.print();
            });
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-700"
        >
          <Printer className="h-3.5 w-3.5" /> {t(lang, "common.print", "Print")}
        </button>
      }
    >
      <div id={BOOKING_REPORT_PRINT_ID} dir={RTL.has(lang) ? "rtl" : "ltr"} lang={lang} data-printable-document="">
        <PurchaseBookingReportBody data={data} lang={lang} mode="document" />
      </div>
    </A4DocumentViewer>
  );
}

/* ---------------------------------------------------------------- the screen (fetch + top bar + steps) */

export type BookingWizardStep = "booking" | "goods" | "shipping" | "reports_tab" | "report";

export interface PurchaseBookingReportScreenProps {
  /** saved purchase_orders id — the report reads that row; without it the live draft is shown */
  orderId?: string | null;
  /** the wizard's current (unsaved) booking, shaped like a purchase_orders row — used only before the first save */
  draftRecord?: AnyRec | null;
  lang?: string;
  userName?: string | null;
  userRole?: string | null;
  activeStep?: BookingWizardStep;
  onStepChange?: (step: BookingWizardStep) => void;
  onSave?: () => void;
  onUpdate?: () => void;
  onNext?: () => void;
  saving?: boolean;
  /** bump to make the report re-read the saved row (e.g. after the wizard saves) */
  reloadToken?: unknown;
  /** test seam */
  fetchImpl?: typeof fetch;
}

export function PurchaseBookingReportScreen({
  orderId,
  draftRecord,
  lang: langProp,
  userName,
  userRole,
  activeStep = "reports_tab",
  onStepChange,
  onSave,
  onUpdate,
  onNext,
  saving,
  reloadToken,
  fetchImpl,
}: PurchaseBookingReportScreenProps) {
  const lang = useLang(langProp);
  const isRtl = RTL.has(lang);
  const doFetch = fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const [record, setRecord] = useState<AnyRec | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !doFetch) return null;
    const res = await doFetch(`/api/erp/purchases/orders/${encodeURIComponent(orderId)}?lang=${encodeURIComponent(lang)}`, { credentials: "same-origin" });
    const payload = await res.json().catch(() => ({}));
    const order = payload?.data?.order ?? payload?.order ?? null;
    if (!res.ok || !order) throw new Error("load failed");
    return order as AnyRec;
  }, [orderId, doFetch, lang]);

  useEffect(() => {
    if (!orderId) { setRecord(null); return; }
    let alive = true;
    setLoading(true);
    setLoadError(false);
    load()
      .then((o) => { if (alive) setRecord(o); })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orderId, load, reloadToken]);

  const source = orderId ? record : draftRecord ?? null;
  const data = useMemo(() => buildPurchaseBookingReport(source, { userName, userRole }), [source, userName, userRole]);

  const saveRemark = useCallback(async (kind: BookingReportRemarkKind, value: string) => {
    if (!orderId || !doFetch) throw new Error("not saved");
    // re-read the saved row so only this one remark changes (never a stale copy of amounts / accounts)
    const fresh = await load();
    if (!fresh) throw new Error("load failed");
    const res = await doFetch(`/api/erp/purchases/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(remarkPatchBody(fresh, kind, value)),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok === false) throw new Error("save failed");
    setRecord({ ...fresh, form_data: remarkPatchBody(fresh, kind, value).formData });
  }, [orderId, doFetch, load]);

  const steps: { id: BookingWizardStep; label: string }[] = [
    { id: "booking", label: t(lang, "pbrep.step1", "Bill & Accounts") },
    { id: "goods", label: t(lang, "pbrep.step2", "Goods Details") },
    { id: "shipping", label: t(lang, "pbrep.step3", "Loading & Receiving") },
    { id: "reports_tab", label: t(lang, "pbrep.step4", "Payment & Summary") },
    { id: "report", label: t(lang, "pbrep.step5", "Review & Confirm") },
  ];
  const activeIdx = Math.max(0, steps.findIndex((s) => s.id === activeStep));

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full min-w-0 space-y-3" data-testid="purchase-booking-report">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <span>{t(lang, "pbrep.crumb_home", "Home")}</span>
          <span aria-hidden="true">{isRtl ? "‹" : "›"}</span>
          <span>{t(lang, "pbrep.crumb_purchase", "Purchase")}</span>
          <span aria-hidden="true">{isRtl ? "‹" : "›"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{t(lang, "pbrep.crumb_new_booking", "New Purchase Booking")}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-1.5">
          {onSave && (
            <button type="button" onClick={onSave} disabled={saving || data.locked && Boolean(orderId)} data-testid="report-save" className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t(lang, "common.save", "Save")}
            </button>
          )}
          <button type="button" onClick={() => setViewOpen(true)} disabled={loading} data-testid="report-view" className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
            <Eye className="h-3.5 w-3.5" /> {t(lang, "pbrep.view", "View")}
          </button>
          {onUpdate && (
            <button type="button" onClick={onUpdate} disabled={saving || !orderId || data.locked} data-testid="report-update" className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> {t(lang, "pbrep.update", "Update")}
            </button>
          )}
          {onNext && (
            <button type="button" onClick={onNext} data-testid="report-next" className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">
              {t(lang, "pbrep.next", "Next")} <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {/* step indicator (the wizard's own five tabs) */}
      <ol className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" data-testid="report-steps">
        {steps.map((s, i) => (
          <li key={s.id} className="flex min-w-0 shrink-0 items-center gap-1 sm:flex-1">
            <button
              type="button"
              onClick={() => onStepChange?.(s.id)}
              aria-current={i === activeIdx ? "step" : undefined}
              className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold", i === activeIdx ? "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black", i === activeIdx ? "bg-sky-600 text-white" : i < activeIdx ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200")}>{i + 1}</span>
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
            {i < steps.length - 1 && <span aria-hidden="true" className="hidden h-px flex-1 bg-slate-200 sm:block dark:bg-slate-700" />}
          </li>
        ))}
      </ol>

      {loading && !record ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t(lang, "common.loading", "Loading...")}</div>
      ) : loadError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{t(lang, "pbrep.load_failed", "Could not load this booking. Please try again.")}</p>
      ) : (
        <>
          {!orderId && (
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              <User className="h-3.5 w-3.5" /> {t(lang, "pbrep.unsaved_note", "Not saved yet — this report shows the booking being entered. Save it to keep remarks.")}
            </p>
          )}
          <PurchaseBookingReportBody data={data} lang={lang} onSaveRemark={orderId ? saveRemark : undefined} />
        </>
      )}

      <PurchaseBookingReportViewer isOpen={viewOpen} onClose={() => setViewOpen(false)} data={data} lang={lang} />
    </div>
  );
}
