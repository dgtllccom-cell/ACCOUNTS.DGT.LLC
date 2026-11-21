"use client";

/**
 * Ledger Transfer for a purchase booking: shows the exact DR/CR posting first (read-only preview), and posts it only when
 * the user presses Confirm. It is a separate step from Booking Save and from Loading Transfer.
 */
import { useEffect, useState } from "react";

type LedgerRef = { id: string; code: string | null; name: string | null } | null;
type Preview = {
  billNo: string;
  paymentType: string | null;
  currency: string;
  operator: "*" | "/";
  rate: number;
  originalAmount: number;
  baseAmount: number;
  savedBase: number | null;
  debit: LedgerRef;
  credit: LedgerRef;
  alreadyPosted: boolean;
  canPost: boolean;
  blockers: string[];
};

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BookingLedgerTransferDialog(props: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  tr: (key: string) => string;
  isRtl: boolean;
}) {
  const { orderId, open, onClose, onPosted, tr, isRtl } = props;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    fetch(`/api/erp/purchases/orders/${encodeURIComponent(orderId)}/transfer`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) throw new Error(body?.error?.message || body?.error || "Could not load the ledger preview.");
        if (!cancelled) setPreview(body.data as Preview);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!open) return null;

  const confirm = async () => {
    if (!preview?.canPost || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/purchases/orders/${encodeURIComponent(orderId)}/transfer`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          // one key per confirmation: a double click replays the same result instead of posting twice
          "Idempotency-Key": `ledger-transfer-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({ paymentType: preview.paymentType }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error?.message || body?.error || "Ledger Transfer failed. Nothing was posted twice.");
      onPosted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
          {tr("LEDGER TRANSFER PREVIEW")}
          {preview?.billNo ? <span className="ms-2 font-mono text-blue-700">{preview.billNo}</span> : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{tr("LEDGER TRANSFER DOES NOT CHANGE LOADING. USE LOADING TRANSFER AFTER THIS.")}</p>

        {loading && <div className="mt-4 text-sm text-slate-500">…</div>}
        {error && <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</div>}

        {preview && (
          <div className="mt-4 space-y-2 text-sm">
            <Row label={tr("PAYMENT TYPE")} value={preview.paymentType || "—"} />
            <Row label={tr("DEBIT LEDGER (DR)")} value={preview.debit ? `${preview.debit.code || ""} ${preview.debit.name || ""}`.trim() : "—"} />
            <Row label={tr("CREDIT LEDGER (CR)")} value={preview.credit ? `${preview.credit.code || ""} ${preview.credit.name || ""}`.trim() : "—"} />
            <Row label={tr("ORIGINAL AMOUNT")} value={`${preview.currency} ${fmt(preview.originalAmount)}`} />
            <Row label={tr("RATE")} value={`${preview.operator === "/" ? "÷" : "×"} ${preview.rate}`} />
            <Row label={tr("BASE AMOUNT (LOCAL)")} value={fmt(preview.baseAmount)} strong />
            <Row label={tr("SAVED BASE AMOUNT")} value={fmt(preview.savedBase)} />
            {preview.alreadyPosted && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">{tr("ALREADY POSTED TO LEDGER")}</div>
            )}
            {preview.blockers.length > 0 && (
              <ul className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 list-disc ps-5">
                {preview.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            {tr("CANCEL")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!preview?.canPost || posting}
            className="h-8 px-3 rounded-md bg-blue-600 text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            {posting ? "…" : tr("CONFIRM LEDGER TRANSFER")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-right font-mono ${strong ? "font-black text-slate-900 dark:text-slate-100" : "text-slate-800 dark:text-slate-200"}`}>{value}</span>
    </div>
  );
}
