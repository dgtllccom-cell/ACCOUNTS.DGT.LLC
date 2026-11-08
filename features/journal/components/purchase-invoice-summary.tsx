"use client";

import React from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { PurchaseInvoiceSummary } from "@/lib/journal/purchase-invoice-summary";

const fmt = (n: number | null, digits = 2) => n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function PurchaseInvoiceSection({ summary: s, section, lang, compact = false, loading = false }: {
  summary: PurchaseInvoiceSummary; section: 'invoice' | 'paid' | 'remaining'; lang: string; compact?: boolean; loading?: boolean;
}) {
  const screen = useErpScreen('pis', lang as never);
  const t = screen.t;
  const value = s[section];
  const money = (n: number | null, ccy: string) => loading && section !== 'invoice' ? '…' : n == null || !ccy ? '—' : `${fmt(n)} ${ccy}`;
  const rate = (n: number | null) => n == null || !s.purchaseCurrency || !s.finalCurrency ? '—' : `1 ${s.purchaseCurrency} = ${fmt(n, 4)} ${s.finalCurrency}`;
  return <section dir={screen.dir} data-testid={`invoice-summary-${section}`} className={compact ? 'min-w-[190px] text-start' : 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900'}>
    {!compact && <h3 className="mb-2 text-sm font-extrabold">{t(section, section === 'invoice' ? 'Purchase Invoice' : section === 'paid' ? 'Invoice Paid' : 'Invoice Remaining')}</h3>}
    <dl className="space-y-1 text-xs">
      <div><dt className="text-[10px] text-slate-500">{t('purchase_amount', 'Purchase currency')}</dt><dd dir="ltr" className="break-words font-bold tabular-nums">{money(value.purchase, s.purchaseCurrency)}</dd></div>
      {section !== 'paid' && <div><dt className="text-[10px] text-slate-500">{t('invoice_rate', 'Saved invoice rate')}</dt><dd dir="ltr" className="break-words tabular-nums">{rate(s.invoiceRate)}</dd></div>}
      <div><dt className="text-[10px] text-slate-500">{t('final_amount', 'Final currency')}</dt><dd dir="ltr" className="break-words font-semibold tabular-nums">{money(value.final, s.finalCurrency)}</dd></div>
    </dl>
    {section === 'paid' && !loading && s.payments.length > 0 && <details open={!compact} className="mt-2">
      <summary className="min-h-7 cursor-pointer text-xs font-semibold text-blue-700 dark:text-blue-300">{t('payments', 'Posted payments')} ({s.payments.length})</summary>
      <ol className="mt-1 space-y-2 text-xs">
        {s.payments.map(p => <li key={p.id} className="border-t border-slate-100 pt-1 dark:border-slate-700">
          <div dir="ltr" className="text-[10px] text-slate-500">{p.date || '—'}</div>
          <div dir="ltr" className="break-words font-semibold tabular-nums">{money(p.purchase, s.purchaseCurrency)}</div>
          <div className="text-[10px] text-slate-500">{t('payment_rate', 'Posted payment rate')}</div>
          <div dir="ltr" className="break-words tabular-nums">{p.paymentCurrency === s.purchaseCurrency || p.paymentCurrency === s.finalCurrency ? rate(p.rate) : '—'}</div>
          <div dir="ltr" className="break-words tabular-nums">{money(p.final, s.finalCurrency)}</div>
        </li>)}
      </ol>
    </details>}
  </section>;
}

export function PurchaseInvoiceSummaryPanel({ summary, lang, loading }: { summary: PurchaseInvoiceSummary; lang: string; loading?: boolean }) {
  const s = useErpScreen('pis', lang as never);
  return <section dir={s.dir} aria-label={s.t('title', 'Invoice summary')} data-testid="purchase-invoice-summary" className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
    {(['invoice', 'paid', 'remaining'] as const).map(section => <PurchaseInvoiceSection key={section} summary={summary} section={section} lang={lang} loading={loading} />)}
  </section>;
}
