"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileCashShell } from "./mobile-cash-shell";

type Line = { payment_entry_type?: string; description?: string; debit?: number | string; credit?: number | string; currency?: string; ledgers?: { name?: string } | null };
type Entry = { id: string; entry_date?: string; voucher_no?: string; journal_no?: string; narration?: string; status?: string; roznamcha_lines?: Line[] };

function num(v: unknown) { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v: unknown) { return num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function MobileCashbookView({
  langProp,
  mode,
}: {
  langProp?: SupportedLanguage;
  mode: "book" | "journal";
}) {
  const s = useErpScreen("mcash", langProp);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(mode === "book" ? today : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ entries: Entry[] }>(`/api/erp/roznamcha?fromDate=${from}&toDate=${to}&limit=200`)
      .then((r) => { if (alive) setEntries(r.entries ?? []); })
      .catch(() => { if (alive) setEntries([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from, to]);

  const title = mode === "book" ? s.t("menu_book", "Cash Book") : s.t("menu_journal", "Journal");

  return (
    <MobileCashShell title={title} langProp={langProp} showBack>
      <div className="flex items-center gap-2">
        <label className="flex-1 text-xs font-bold text-slate-500">
          {s.t("date", "Date")}
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" />
        </label>
        <label className="flex-1 text-xs font-bold text-slate-500">
          &nbsp;
          <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-800 dark:bg-slate-900" />
        </label>
      </div>

      <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
        {s.t("view_only", "View only")}
      </span>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">{s.t("loading", "Loading")}…</p>
      ) : !entries || entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{s.t("no_entries", "No entries for the selected day")}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {entries.map((e) => {
            const dr = (e.roznamcha_lines ?? []).reduce((a, l) => a + num(l.debit), 0);
            const cr = (e.roznamcha_lines ?? []).reduce((a, l) => a + num(l.credit), 0);
            const cur = e.roznamcha_lines?.[0]?.currency ?? "";
            return (
              <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="font-mono">{String(e.entry_date ?? "").slice(0, 10)}</span>
                  <span className="font-mono">{e.voucher_no || e.journal_no}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-slate-800 dark:text-slate-200">{e.narration || "—"}</p>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-mono text-emerald-600">{s.t("debit", "Debit")}: {fmt(dr)} {cur}</span>
                  <span className="font-mono text-rose-600">{s.t("credit", "Credit")}: {fmt(cr)} {cur}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </MobileCashShell>
  );
}
