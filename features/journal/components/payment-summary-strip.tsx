"use client";

import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { PaymentSummaryFigures } from "@/lib/journal/purchase-payment-entry-model";

/**
 * The compact payment summary shown at the top of every payment page (Purchase Advance / Endorsement / Remaining / Final / Credit / Invoice and
 * the Sales payment pages): eight figures in ONE row (two per row on a phone, four on a tablet), all taken from the saved payment records.
 *
 *   Total Purchase / Contract Amount   - what the bill is worth
 *   Total Advance Amount               - CALCULATED (contract x advance %): what should be paid as advance
 *   Total Advance Paid                 - what WAS paid as advance (with "still due" when it falls short)
 *   Total Remaining Payment            - paid as Remaining
 *   Total Final Payment                - paid as Final / Credit
 *   Overall Paid Amount                - everything paid
 *   Outstanding Balance                - what is still to pay
 *   Payment Percentage                 - overall paid / contract
 *
 * Every amount is in the bill's own currency (named on the tile); the local (branch) equivalent is the small grey line beneath - the two
 * currencies are never added together or shown without their code.
 */

export type { PaymentSummaryFigures };

const fmt = (v: unknown, d = 2) => Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

type Tone = "slate" | "blue" | "green" | "amber" | "violet" | "emerald" | "rose";
const TONE: Record<Tone, { box: string; label: string; value: string }> = {
  slate: { box: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900", label: "text-slate-500", value: "text-slate-900 dark:text-slate-100" },
  blue: { box: "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/30", label: "text-blue-700 dark:text-blue-300", value: "text-blue-900 dark:text-blue-100" },
  green: { box: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/25", label: "text-emerald-700 dark:text-emerald-300", value: "text-emerald-900 dark:text-emerald-100" },
  amber: { box: "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25", label: "text-amber-700 dark:text-amber-300", value: "text-amber-900 dark:text-amber-100" },
  violet: { box: "border-violet-200 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/25", label: "text-violet-700 dark:text-violet-300", value: "text-violet-900 dark:text-violet-100" },
  emerald: { box: "border-emerald-300 bg-emerald-100/60 dark:border-emerald-800 dark:bg-emerald-950/40", label: "text-emerald-800 dark:text-emerald-200", value: "text-emerald-950 dark:text-emerald-50" },
  rose: { box: "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30", label: "text-rose-700 dark:text-rose-300", value: "text-rose-900 dark:text-rose-100" }
};

function Tile({ id, tone, label, value, unit, sub, subTone, children }: { id: string; tone: Tone; label: string; value: string; unit?: string; sub?: string; subTone?: "warn" | "ok"; children?: React.ReactNode }) {
  const c = TONE[tone];
  return (
    <div data-testid={`psum-${id}`} className={cn("min-w-0 rounded-lg border px-2.5 py-2", c.box)}>
      <div className={cn("line-clamp-2 min-h-[24px] text-[10px] font-extrabold uppercase leading-[12px] tracking-wide", c.label)} title={label}>{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-1 tabular-nums", c.value)} dir="ltr">
        <span className="truncate text-[15px] font-black leading-none">{value}</span>
        {unit ? <span className="text-[10px] font-bold opacity-70">{unit}</span> : null}
      </div>
      {sub ? (
        <div className={cn("mt-0.5 truncate text-[10px] font-semibold tabular-nums", subTone === "warn" ? "text-amber-700 dark:text-amber-300" : subTone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400")} dir="ltr" title={sub}>{sub}</div>
      ) : (
        <div className="mt-0.5 text-[10px] leading-none">&nbsp;</div>
      )}
      {children}
    </div>
  );
}

export function PaymentSummaryStrip({ lang, currency, localCurrency, figures, variant = "purchase", loading = false }: { lang: string; currency: string; localCurrency: string; figures: PaymentSummaryFigures; variant?: "purchase" | "sales"; loading?: boolean }) {
  const s = useErpScreen("psum", lang as never);
  const f = figures;
  const showLocal = Boolean(localCurrency) && localCurrency.toUpperCase() !== currency.toUpperCase();
  const local = (v: number) => (showLocal && !pending ? `≈ ${fmt(v)} ${localCurrency}` : undefined);
  // the figures that come from the payment rows read "…" until the rows are in, and "—" when the order says money was paid but no row says which kind
  const pending = loading;
  const splitUnknown = !loading && !f.splitKnown;
  const paidVal = (v: number) => (pending ? "…" : fmt(v));
  const splitVal = (v: number) => (pending ? "…" : splitUnknown ? "—" : fmt(v));
  const pct = pending ? 0 : Math.max(0, Math.min(100, f.paidPercent));
  const advanceCovered = f.advanceStillDue <= 0.01;
  return (
    <section dir={s.dir} aria-label={s.t("title", "Payment summary")} data-testid="payment-summary-strip">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <Tile id="contract" tone="slate" label={variant === "sales" ? s.t("contract_sales", "Total Sales / Contract Amount") : s.t("contract", "Total Purchase / Contract Amount")} value={fmt(f.contractTotal)} unit={currency} sub={local(f.contractTotalLocal)} />
        <Tile id="advance-calc" tone="blue" label={s.t("advance_calc", "Total Advance Amount")} value={fmt(f.advanceRequired)} unit={currency} sub={f.advancePercent > 0 ? `${s.t("advance_calc_note", "Calculated {pct}%").replace("{pct}", fmt(f.advancePercent, f.advancePercent % 1 ? 2 : 0))}${showLocal ? ` · ${fmt(f.advanceRequiredLocal)} ${localCurrency}` : ""}` : local(f.advanceRequiredLocal)} />
        <Tile id="advance-paid" tone="green" label={s.t("advance_paid", "Total Advance Paid")} value={splitVal(f.advancePaid)} unit={currency}
          sub={f.advanceRequired > 0 && !pending && !splitUnknown ? (advanceCovered ? "✓" : s.t("advance_due", "Still due {amount}").replace("{amount}", `${fmt(f.advanceStillDue)} ${currency}`)) : undefined}
          subTone={f.advanceRequired > 0 && !pending && !splitUnknown ? (advanceCovered ? "ok" : "warn") : undefined} />
        <Tile id="remaining" tone="violet" label={s.t("remaining", "Total Remaining Payment")} value={splitVal(f.remainingPaid)} unit={currency} />
        <Tile id="final" tone="amber" label={s.t("final", "Total Final Payment")} value={splitVal(f.finalPaid)} unit={currency} />
        <Tile id="overall" tone="emerald" label={s.t("overall", "Overall Paid Amount")} value={paidVal(f.totalPaid)} unit={currency} sub={local(f.totalPaidLocal)} />
        <Tile id="outstanding" tone={f.balance > 0.01 ? "rose" : "green"} label={s.t("outstanding", "Outstanding Balance")} value={paidVal(f.balance)} unit={currency} sub={local(f.balanceLocal)} />
        <Tile id="percent" tone="slate" label={s.t("percent", "Payment Percentage")} value={pending ? "…" : `${fmt(f.paidPercent, 1)}%`}>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </Tile>
      </div>
    </section>
  );
}
