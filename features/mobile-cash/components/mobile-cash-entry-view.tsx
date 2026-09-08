"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileCashShell } from "./mobile-cash-shell";

type Ledger = {
  id: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  scope: string | null;
  city_branch_id: string | null;
  country_branch_id: string | null;
  country_id: string | null;
};

type Scope = {
  cityBranchId: string | null;
  countryBranchId: string | null;
  branchCountryId: string | null;
};

function genCode(prefix: string) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

/**
 * Brother-User cash entry — deliberately tiny. Posts ONE line to the EXISTING
 * /api/erp/roznamcha endpoint (same validation, idempotency lock, posting engine,
 * approval rules). Locked to the user's own branch; no country/branch pickers.
 */
export function MobileCashEntryView({ langProp }: { langProp?: SupportedLanguage }) {
  const s = useErpScreen("mcash", langProp);
  const router = useRouter();

  const [scope, setScope] = useState<Scope | null>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<"receipt" | "payment">("receipt");
  const [q, setQ] = useState("");
  const [account, setAccount] = useState<Ledger | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet<any>("/api/erp/auth/session"),
      apiGet<{ ledgers: Ledger[] }>("/api/erp/ledgers"),
    ])
      .then(([sess, led]) => {
        if (!alive) return;
        const sum = sess?.scopes?.summary ?? {};
        setScope({
          cityBranchId: sess?.scopes?.cityBranchIds?.[0] ?? sum.cityBranchId ?? null,
          countryBranchId: sess?.scopes?.countryBranchIds?.[0] ?? sum.countryBranchId ?? null,
          branchCountryId: sum.branchCountryId ?? sum.countryId ?? null,
        });
        setLedgers(led.ledgers ?? []);
      })
      .catch(() => { if (alive) setMsg({ tone: "err", text: s.t("no_results", "No accounts found") }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n
      ? ledgers.filter((l) => `${l.code ?? ""} ${l.name ?? ""}`.toLowerCase().includes(n))
      : ledgers;
    return list.slice(0, 25);
  }, [q, ledgers]);

  const amountNum = Number(amount);
  const canSave =
    !!account && Number.isFinite(amountNum) && amountNum > 0 && !!scope?.cityBranchId && !busy;

  async function submit() {
    if (!canSave || !account || !scope) return;
    setBusy(true);
    setMsg(null);
    try {
      const isReceipt = kind === "receipt";
      const body = {
        mode: "post" as const,
        type: "branch" as const,
        // Only the city-branch scope is passed — a Brother User's session carries
        // no country/main-branch id, and passing one would (correctly) 403.
        countryId: null,
        countryBranchId: null,
        cityBranchId: scope.cityBranchId,
        entryDate: date,
        journalNo: genCode("J"),
        voucherNo: genCode("V"),
        referenceNo: undefined,
        narration: remarks.trim() || undefined,
        originalLanguage: s.lang,
        sourceModule: "cash_entry",
        sourceTransactionType: "Cash Book No.",
        roznamchaCategory: "cash" as const,
        paymentDetails: {
          roznamchaBookType: "cash",
          paymentType: isReceipt ? "money_received" : "money_paid",
          paymentMode: isReceipt ? "DEBIT" : "CREDIT",
          finalAmount: amountNum,
          currency: account.currency || "USD",
          exchangeRate: 1,
          counterLedgerId: account.id,
        },
        lines: [
          {
            paymentEntryType: isReceipt ? ("cash_receipt" as const) : ("cash_payment" as const),
            ledgerId: account.id,
            description: remarks.trim() || undefined,
            debit: isReceipt ? amountNum : 0,
            credit: isReceipt ? 0 : amountNum,
            currency: account.currency || "USD",
            exchangeRate: 1,
          },
        ],
      };
      const res = await apiPost<any>("/api/erp/roznamcha", body);
      setMsg({ tone: "ok", text: `${s.t("app_title", "Cash & Ledger")} — ${res?.voucherNo || res?.entryId || "OK"}` });
      setAmount("");
      setRemarks("");
      setAccount(null);
      setQ("");
    } catch (e: any) {
      setMsg({ tone: "err", text: e?.message || "Error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileCashShell title={s.t("menu_entry", "New Cash Entry")} langProp={langProp} showBack>
      {loading ? (
        <p className="text-sm text-slate-400">{s.t("loading", "Loading")}…</p>
      ) : (
        <div className="grid gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {s.t("entry_help", "Use the standard cash form. Your entry follows the normal validation and approval rules.")}
          </p>

          {/* receipt / payment */}
          <div className="grid grid-cols-2 gap-2">
            {(["receipt", "payment"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-xl border py-3 text-sm font-black active:scale-[0.98] ${
                  kind === k
                    ? k === "receipt"
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-rose-500 bg-rose-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                {k === "receipt" ? s.t("kind_receipt", "Receipt (money in)") : s.t("kind_payment", "Payment (money out)")}
              </button>
            ))}
          </div>

          {/* account */}
          <div>
            <label className="text-xs font-bold text-slate-500">{s.t("field_account", "Account")}</label>
            {account ? (
              <button
                type="button"
                onClick={() => setAccount(null)}
                className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-3 text-start dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{account.name || account.code}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{account.code} · {account.currency}</span>
                </span>
                <span className="text-xs font-bold text-sky-600">{s.t("change", "Change")}</span>
              </button>
            ) : (
              <>
                <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <Search className="h-5 w-5 text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={s.t("search_account", "Search account by name or number")}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>
                {results.length > 0 && (
                  <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    {results.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setAccount(l)}
                          className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-start last:border-0 dark:border-slate-800"
                        >
                          <span className="truncate text-sm">{l.name || l.code}</span>
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">{l.code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* amount */}
          <div>
            <label className="text-xs font-bold text-slate-500">{s.t("field_amount", "Amount")}</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-black tabular-nums dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          {/* date */}
          <div>
            <label className="text-xs font-bold text-slate-500">{s.t("date", "Date")}</label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          {/* remarks */}
          <div>
            <label className="text-xs font-bold text-slate-500">{s.t("field_remarks", "Remarks")}</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          {msg && (
            <p className={`rounded-xl px-3 py-2 text-sm font-bold ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
              {msg.text}
            </p>
          )}

          <button
            type="button"
            disabled={!canSave}
            onClick={submit}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-black text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            <Check className="h-5 w-5" />
            {busy ? s.t("saving", "Saving…") : s.t("save_entry", "Save entry")}
          </button>
        </div>
      )}
    </MobileCashShell>
  );
}
