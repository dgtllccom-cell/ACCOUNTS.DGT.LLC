"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileCashShell } from "./mobile-cash-shell";

type Ledger = {
  id: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  current_balance?: number | null;
};

type StatementRow = Record<string, unknown>;

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(v: unknown) {
  return num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pick(row: StatementRow, keys: string[]) {
  for (const k of keys) if (row[k] != null && row[k] !== "") return row[k];
  return null;
}

export function MobileLedgerView({ langProp }: { langProp?: SupportedLanguage }) {
  const s = useErpScreen("mcash", langProp);
  const [q, setQ] = useState("");
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ledger | null>(null);
  const [statement, setStatement] = useState<StatementRow[] | null>(null);
  const [loadingStmt, setLoadingStmt] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<{ ledgers: Ledger[] }>("/api/erp/ledgers")
      .then((r) => { if (alive) setLedgers(r.ledgers ?? []); })
      .catch(() => { if (alive) setLedgers([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ledgers.slice(0, 40);
    return ledgers
      .filter((l) => `${l.code ?? ""} ${l.name ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [q, ledgers]);

  function openLedger(l: Ledger) {
    setSelected(l);
    setStatement(null);
    setLoadingStmt(true);
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    apiGet<{ statement: StatementRow[] }>(`/api/erp/accounting/ledgers/${l.id}/statement?fromDate=${from}&toDate=${to}`)
      .then((r) => setStatement(r.statement ?? []))
      .catch(() => setStatement([]))
      .finally(() => setLoadingStmt(false));
  }

  if (selected) {
    return (
      <MobileCashShell title={selected.name || selected.code || s.t("menu_ledger", "Ledger Search")} langProp={langProp} showBack>
        <button onClick={() => setSelected(null)} className="mb-3 text-xs font-bold text-sky-600">
          ‹ {s.t("menu_ledger", "Ledger Search")}
        </button>
        <div className="rounded-xl bg-white p-3 text-sm dark:bg-slate-900">
          <div className="flex justify-between font-black">
            <span>{selected.name}</span>
            <span className="font-mono">{selected.code}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{s.t("balance", "Balance")}</span>
            <span className="font-mono font-bold">{fmt(selected.current_balance)} {selected.currency}</span>
          </div>
        </div>

        <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
          {s.t("view_only", "View only")}
        </span>

        {loadingStmt ? (
          <p className="mt-4 text-sm text-slate-400">{s.t("loading", "Loading")}…</p>
        ) : !statement || statement.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">{s.t("no_entries", "No entries for the selected day")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className={`py-1 ${s.textStart}`}>{s.t("date", "Date")}</th>
                  <th className={`py-1 ${s.textStart}`}>{s.t("details", "Details")}</th>
                  <th className="py-1 text-end">{s.t("debit", "Debit")}</th>
                  <th className="py-1 text-end">{s.t("credit", "Credit")}</th>
                  <th className="py-1 text-end">{s.t("balance", "Balance")}</th>
                </tr>
              </thead>
              <tbody>
                {statement.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 font-mono">{String(pick(row, ["entry_date", "date", "txn_date", "created_at"]) ?? "").slice(0, 10)}</td>
                    <td className="py-1.5">{String(pick(row, ["narration", "description", "particulars", "details"]) ?? "")}</td>
                    <td className="py-1.5 text-end font-mono">{fmt(pick(row, ["debit", "debit_amount", "dr"]))}</td>
                    <td className="py-1.5 text-end font-mono">{fmt(pick(row, ["credit", "credit_amount", "cr"]))}</td>
                    <td className="py-1.5 text-end font-mono">{fmt(pick(row, ["balance", "running_balance", "closing_balance"]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MobileCashShell>
    );
  }

  return (
    <MobileCashShell title={s.t("menu_ledger", "Ledger Search")} langProp={langProp} showBack>
      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={s.t("search_account", "Search account by name or number")}
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">{s.t("loading", "Loading")}…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{s.t("no_results", "No accounts found")}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {filtered.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => openLedger(l)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-start active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{l.name || l.code}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{l.code}</span>
                </span>
                <span className="shrink-0 font-mono text-xs font-bold">{fmt(l.current_balance)} {l.currency}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MobileCashShell>
  );
}
