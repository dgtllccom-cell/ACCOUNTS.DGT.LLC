import React from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { groupExactSerials, transferSerialLevels, type ScopeSerials, type TransferScopeSerials } from "@/lib/sales/sales-transfer-serials";

export function SalesTransferScopeSerials({ serials, booking, lang }: { serials?: TransferScopeSerials | null; booking?: ScopeSerials | null; lang: string }) {
  if (!serials && !booking) return null;
  const levels = transferSerialLevels.map(([key, name]) => ({
    key, name, refs: groupExactSerials([["Booking", booking?.[key]], ["VR", serials?.voucher?.[key]], ["DR", serials?.debit?.[key]], ["CR", serials?.credit?.[key]]] as const),
  }));
  if (!levels.some(level => level.refs.length)) return null;
  const tr = (label: string) => translateHeader(lang, label);

  return <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    aria-label={tr("Serial Numbers by Scope")}>
    <h3 className="bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-950 dark:bg-blue-950 dark:text-blue-100">{tr("Serial Numbers by Scope")}</h3>
    <dl className="divide-y divide-slate-100 px-2 dark:divide-slate-800">
      {levels.map(({ key, name, refs }) => <div key={key} className="grid grid-cols-[minmax(4rem,1fr)_minmax(0,2fr)] items-start gap-2 px-1 py-1.5">
        <dt className="text-xs font-medium">{tr(name)}</dt>
        <dd className="flex min-w-0 flex-wrap gap-1">
          {refs.length ? refs.map(({ kinds, serial }) => <span key={serial} className="inline-flex max-w-full items-baseline gap-1 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-[10px] text-slate-600 dark:text-slate-300"><bdi>{kinds.map(kind => tr(kind)).join("/")}</bdi></span>
            <bdi className="min-w-0 break-all font-mono text-[10px] font-semibold">{serial}</bdi>
          </span>) : <span className="text-xs text-slate-500">—</span>}
        </dd>
      </div>)}
    </dl>
  </section>;
}
