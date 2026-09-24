"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Wallet, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type MinimalAccountView = {
  id: string;
  code: string;
  name: string;
  currency: string;
  accountNumber: string | null;
  manualReferenceNumber: string | null;
  customerNumber: string | null;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  operationalDomain: string | null;
  ledgerId: string | null;
  isOwnBranch: boolean;
  currentBalance: number | null;
};

type OwnTransaction = {
  line_id: string;
  entry_id: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  description: string | null;
  voucher_no: string;
  entry_date: string;
  created_at: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.error || body?.data?.error || "Request failed.", status: res.status };
  return { ok: true, data: body?.data ?? body, status: res.status };
}

export function ShippingAccountAccessView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("shipacc", langProp);

  const [countryId, setCountryId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinimalAccountView[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MinimalAccountView | null>(null);
  const [ownTransactions, setOwnTransactions] = useState<OwnTransaction[]>([]);

  const [postType, setPostType] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasAccountsRead = isSuperAdmin || permissions.includes("accounts:read") || permissions.includes("accounts:*") || permissions.includes("*:*");
  const canPostCrossBranch = isSuperAdmin || permissions.includes("roznamcha:post_cross_branch") || permissions.includes("roznamcha:*") || permissions.includes("*:*");

  useEffect(() => {
    fetchJson<any>("/api/erp/auth/session").then((res) => {
      if (res.ok && res.data) {
        setCountryId(res.data.scopes?.countryIds?.[0] ?? res.data.effectiveCountryId ?? null);
        setPermissions(res.data.permissions ?? []);
        setIsSuperAdmin(Boolean(res.data.scopes?.isSuperAdmin));
      }
      setBootLoading(false);
    });
  }, []);

  const runSearch = useCallback(async () => {
    if (!countryId || !query.trim()) return;
    setSearching(true);
    setSearchError(null);
    const res = await fetchJson<{ accounts: MinimalAccountView[] }>(
      `/api/erp/shipping/account-access/search?q=${encodeURIComponent(query.trim())}&countryId=${countryId}`
    );
    setSearching(false);
    if (!res.ok) {
      setSearchError(res.error ?? "Search failed.");
      setResults([]);
      return;
    }
    setResults(res.data?.accounts ?? []);
  }, [countryId, query]);

  const selectAccount = useCallback(async (accountId: string) => {
    const res = await fetchJson<{ account: MinimalAccountView; ownTransactions: OwnTransaction[] }>(
      `/api/erp/shipping/account-access/${accountId}`
    );
    if (!res.ok || !res.data) return;
    setSelected(res.data.account);
    setOwnTransactions(res.data.ownTransactions ?? []);
    setCurrency(res.data.account.currency ?? "");
    setPostMessage(null);
  }, []);

  const submitPost = useCallback(async () => {
    if (!selected || !countryId) return;
    setPosting(true);
    setPostMessage(null);
    const res = await fetchJson<{ entryId: string }>("/api/erp/shipping/account-access/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryId,
        countryBranchId: selected.isOwnBranch ? selected.countryBranchId : undefined,
        cityBranchId: selected.isOwnBranch ? selected.cityBranchId : undefined,
        accountId: selected.id,
        paymentEntryType: postType,
        amount: Number(amount),
        currency,
        entryDate,
        description,
        referenceNo
      })
    });
    setPosting(false);
    if (!res.ok) {
      setPostMessage({ type: "error", text: res.error ?? "Failed to post transaction." });
      return;
    }
    setPostMessage({ type: "success", text: s.t("post_success", "Transaction posted successfully.") });
    setAmount("");
    setDescription("");
    setReferenceNo("");
    void selectAccount(selected.id);
  }, [selected, countryId, postType, amount, currency, entryDate, description, referenceNo, s, selectAccount]);

  if (bootLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{s.t("loading", "Loading...")}</div>;
  }

  if (!hasAccountsRead) {
    return (
      <div dir={s.dir} className="p-6">
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-6">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className={`font-semibold text-amber-900 dark:text-amber-200 ${s.textStart}`}>
                {s.t("permission_denied_title", "Access Restricted")}
              </p>
              <p className={`mt-1 text-sm text-amber-800 dark:text-amber-300 ${s.textStart}`}>
                {s.t("permission_denied_body", "Your account does not have permission to search or create accounts. Ask your Super Admin to grant Account Search / Account Create in the Permission Control Center.")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir={s.dir} className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className={s.textStart}>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Wallet className="h-5 w-5" /> {s.t("title", "Shipping Account Access")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.t("subtitle", "Search Account Master, create a shipping account in your own country, and post authorized cross-branch payments.")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={`text-base ${s.textStart}`}>{s.t("search_button", "Search")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.t("search_placeholder", "Search by account code, name, account number, or reference...")}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <Button onClick={runSearch} disabled={searching || !query.trim()}>
              <Search className="mr-1 h-4 w-4" /> {s.t("search_button", "Search")}
            </Button>
          </div>

          {searchError && <p className="text-sm text-red-600">{searchError}</p>}

          {results.length === 0 && !searching && query.trim() && !searchError && (
            <p className="text-sm text-muted-foreground">{s.t("no_results", "No matching accounts found in your country.")}</p>
          )}

          {results.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className={`p-2 font-medium ${s.textStart}`}>{s.t("col_code", "Code")}</th>
                    <th className={`p-2 font-medium ${s.textStart}`}>{s.t("col_name", "Account Name")}</th>
                    <th className={`p-2 font-medium ${s.textStart}`}>{s.t("col_currency", "Currency")}</th>
                    <th className={`p-2 font-medium ${s.textStart}`}>{s.t("col_branch", "Branch")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 font-mono">{row.code}</td>
                      <td className="p-2">{row.name}</td>
                      <td className="p-2">{row.currency}</td>
                      <td className="p-2">
                        {row.isOwnBranch ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {s.t("own_branch_badge", "Your Branch")}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {row.currentBalance === null ? s.t("balance_hidden", "Balance hidden — outside your branch scope") : "—"}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-end">
                        <Button size="sm" variant="outline" onClick={() => selectAccount(row.id)}>
                          {s.t("select_account", "Select")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center justify-between text-base ${s.textStart}`}>
              <span>{selected.name} ({selected.code})</span>
              {selected.currentBalance !== null && (
                <span className="font-mono text-sm text-muted-foreground">
                  {selected.currentBalance.toLocaleString()} {selected.currency}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={`text-xs text-muted-foreground ${s.textStart}`}>
              {selected.isOwnBranch || selected.currentBalance !== null
                ? s.t("full_ledger_notice", "You are viewing this account's full ledger because it is in your own branch or you hold Full Ledger View permission.")
                : s.t("narrow_ledger_notice", "This account belongs to another branch. You can see only enough information to identify it and your own posted transactions — not its full ledger or balance history.")}
            </p>

            <div>
              <p className={`mb-2 text-sm font-semibold ${s.textStart}`}>{s.t("own_transactions_title", "Your Transactions on This Account")}</p>
              {ownTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{s.t("no_own_transactions", "You have not posted any transactions against this account yet.")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <tbody>
                      {ownTransactions.map((tx) => (
                        <tr key={tx.line_id} className="border-t">
                          <td className="p-2">{tx.entry_date}</td>
                          <td className="p-2">{tx.voucher_no}</td>
                          <td className="p-2">{tx.description}</td>
                          <td className="p-2 text-end font-mono">
                            {Number(tx.debit) > 0 ? `+${tx.debit}` : `-${tx.credit}`} {tx.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {canPostCrossBranch ? (
              <div className="space-y-3 rounded-md border p-4">
                <p className={`text-sm font-semibold ${s.textStart}`}>{s.t("post_title", "Post Authorized Payment")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("post_type", "Transaction Type")}</label>
                    <select
                      className="w-full rounded-md border bg-background p-2 text-sm"
                      value={postType}
                      onChange={(e) => setPostType(e.target.value as "debit" | "credit")}
                    >
                      <option value="debit">{s.t("post_debit", "Debit (Receive)")}</option>
                      <option value="credit">{s.t("post_credit", "Credit (Pay)")}</option>
                    </select>
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("amount", "Amount")}</label>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("currency", "Currency")}</label>
                    <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("entry_date", "Entry Date")}</label>
                    <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("description", "Description")}</label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className={`mb-1 block text-xs text-muted-foreground ${s.textStart}`}>{s.t("reference_no", "Reference No.")}</label>
                    <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                  </div>
                </div>
                {postMessage && (
                  <p className={`text-sm ${postMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{postMessage.text}</p>
                )}
                <Button onClick={submitPost} disabled={posting || !amount || !currency}>
                  {s.t("post_submit", "Post Transaction")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{s.t("post_denied", "You are not authorized to post cross-branch transactions. Contact your Super Admin.")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {countryId && (
        <a
          href={`/dashboard/accounts/setup?operationalDomain=shipping&countryId=${countryId}`}
          className="inline-flex items-center gap-1 text-sm text-primary underline"
        >
          {s.t("create_account_link", "Create a new Account")} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
