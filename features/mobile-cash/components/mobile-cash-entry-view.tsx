"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { apiGet, apiFetch } from "@/lib/api/client";
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

function genCode(prefix: string) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}
function newIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `mcash-${crypto.randomUUID()}`;
  } catch { /* ignore */ }
  return `mcash-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Brother-User cash entry — deliberately tiny, but ACCOUNTING-CORRECT:
 *  - amount is in the SELECTED ACCOUNT's own currency (never defaulted to USD);
 *  - posting branch is the account's own branch (server re-validates it against
 *    the user's scope and the account), so a branch user posts only in their
 *    branch and a country-level user posts in whichever authorized branch owns
 *    the account they picked;
 *  - the entry posts ONE line through the EXISTING /api/erp/roznamcha engine —
 *    same validation, same idempotency lock (stable X-Idempotency-Key + voucher
 *    per attempt, rotated only on success), same posting + approval rules.
 */
export function MobileCashEntryView({ langProp }: { langProp?: SupportedLanguage }) {
  const s = useErpScreen("mcash", langProp);

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

  // Stable per-attempt identity — makes a retry / double-click / concurrent submit
  // the SAME logical request so the server idempotency lock collapses them.
  const attempt = useRef<{ key: string; voucherNo: string; journalNo: string }>({
    key: newIdempotencyKey(),
    voucherNo: genCode("V"),
    journalNo: genCode("J"),
  });
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    apiGet<{ ledgers: Ledger[] }>("/api/erp/ledgers")
      .then((r) => { if (alive) setLedgers((r.ledgers ?? []).filter((l) => !!l.currency)); })
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
    !!account && !!account.currency && Number.isFinite(amountNum) && amountNum > 0 &&
    !!(account.city_branch_id || account.country_branch_id) && !busy;

  // Post at the account's own branch level. A city-branch account posts with only
  // cityBranchId (a Brother-User session authorizes the city branch, not its
  // parent main branch); a main-branch-level account posts with countryBranchId.
  const postCityBranchId = account?.city_branch_id ?? null;
  const postCountryBranchId = account && !account.city_branch_id ? account.country_branch_id ?? null : null;

  async function submit() {
    if (!canSave || !account || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    const isReceipt = kind === "receipt";
    const cur = (account.currency || "").toUpperCase();
    try {
      const body = {
        mode: "post" as const,
        type: "branch" as const,
        // No country id — the server resolves it from the branch (a branch-scoped
        // Brother-User session legitimately carries none). Passing one would 403.
        countryId: null,
        countryBranchId: postCountryBranchId,
        cityBranchId: postCityBranchId,
        entryDate: date,
        journalNo: attempt.current.journalNo,
        voucherNo: attempt.current.voucherNo,
        narration: remarks.trim() || undefined,
        originalLanguage: s.lang,
        sourceModule: "cash_entry",
        sourceTransactionType: "Cash Book No.",
        sourceReferenceNo: attempt.current.voucherNo,
        roznamchaCategory: "cash" as const,
        paymentDetails: {
          roznamchaBookType: "cash",
          paymentType: isReceipt ? "money_received" : "money_paid",
          paymentMode: isReceipt ? "DEBIT" : "CREDIT",
          finalAmount: amountNum,
          currency: cur,
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
            currency: cur,
            exchangeRate: 1,
          },
        ],
      };
      const res = await apiFetch<any>("/api/erp/roznamcha", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": attempt.current.key },
        body: JSON.stringify(body),
      });
      const ref = res?.voucherNo || res?.entryId || attempt.current.voucherNo;
      setMsg({ tone: "ok", text: `${s.t("saved_ok", "Saved")} — ${ref}` });
      // New attempt identity for the NEXT entry; a late retry of the old one is
      // still collapsed by the (now COMPLETED) idempotency key on the server.
      attempt.current = { key: newIdempotencyKey(), voucherNo: genCode("V"), journalNo: genCode("J") };
      setAmount("");
      setRemarks("");
      setAccount(null);
      setQ("");
    } catch (e: any) {
      setMsg({ tone: "err", text: e?.message || "Error" });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const cur = account?.currency?.toUpperCase() || "";

  return (
    <MobileCashShell title={s.t("menu_entry", "New Cash Entry")} langProp={langProp} showBack>
      {loading ? (
        <p className="text-sm text-slate-400">{s.t("loading", "Loading")}…</p>
      ) : (
        <div className="grid gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {s.t("entry_help", "Use the standard cash form. Your entry follows the normal validation and approval rules.")}
          </p>

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
                  <span className="block font-mono text-[11px] text-slate-400">{account.code} · {cur}</span>
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
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">{l.code} · {(l.currency || "").toUpperCase()}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">
              {s.t("field_amount", "Amount")}{cur ? ` (${cur})` : ""}
            </label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-black tabular-nums dark:border-slate-800 dark:bg-slate-900"
            />
            {account && cur && (
              <p className="mt-1 text-[11px] text-slate-400">
                {s.t("currency_note", "Amount is in the account's own currency; foreign currency is converted at the approved daily rate on the server.")}
              </p>
            )}
          </div>

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
