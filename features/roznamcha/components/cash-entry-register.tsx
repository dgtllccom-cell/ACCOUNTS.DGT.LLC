"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, RefreshCcw, Search, Wallet, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { CashEntryForm } from "./cash-entry-form";

type RoznamchaEntryRow = {
  id: string;
  journal_no: string | null;
  voucher_no: string | null;
  entry_date: string;
  narration: string | null;
  status: string;
  country_branches?: { name?: string } | null;
  city_branches?: { name?: string } | null;
  roznamcha_lines?: Array<{ debit: number; credit: number; currency: string }>;
};

/**
 * Table-first wrapper for Daily Cash Entry: shows the real Roznamcha
 * register on load, and only opens the existing CashEntryForm (unchanged,
 * with its own full posting logic) after "+ New Entry" is clicked.
 */
export function CashEntryRegister({ lang }: { lang: SupportedLanguage }) {
  const isRtl = getLanguageDirection(lang) === "rtl";
  const _ = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const [rows, setRows] = useState<RoznamchaEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/roznamcha?limit=200", { cache: "no-store" });
      const json = await res.json();
      setRows(json?.data?.entries ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [r.journal_no, r.voucher_no, r.narration].some((v) => (v || "").toLowerCase().includes(q));
  });

  if (viewMode === "form") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="w-full px-2 py-4 space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            setViewMode("list");
            void loadRows();
          }}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {_("cer.back_to_register", "Back to Register")}
        </Button>
        <CashEntryForm lang={lang} pageTitle={t(lang, "nav.cash_entry", "Cash Entry")} scopeMode="auto" />
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-[1680px] space-y-3 p-3">
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b py-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <Wallet className="h-4 w-4" />
            {_("cer.title", "Daily Cash Entry Register")} ({filteredRows.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={_("cer.search_ph", "Search journal, voucher, narration...")}
                className="h-9 pl-9 text-xs"
              />
            </div>
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void loadRows()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button type="button" size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setViewMode("form")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {_("cer.new_entry", "New Entry")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b bg-muted/50">
                <tr>
                  <Th className="px-3 py-2 font-black uppercase">{_("cer.col_journal_no", "Journal No")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("cer.col_date", "Date")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("cer.col_narration", "Narration")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("cer.col_branch", "Branch")}</Th>
                  <Th className="px-3 py-2 font-black uppercase text-right">{_("cer.col_debit", "Debit")}</Th>
                  <Th className="px-3 py-2 font-black uppercase text-right">{_("cer.col_credit", "Credit")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("common.status", "Status")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      {_("common.loading", "Loading...")}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      {_("cer.empty", "No cash entries found. Click \"New Entry\" to create one.")}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const totalDebit = (r.roznamcha_lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
                    const totalCredit = (r.roznamcha_lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-300">{r.journal_no || r.voucher_no || "-"}</td>
                        <td className="px-3 py-2 tabular-nums">{r.entry_date ? String(r.entry_date).slice(0, 10) : "-"}</td>
                        <td className="px-3 py-2 max-w-[280px] truncate">{r.narration || "-"}</td>
                        <td className="px-3 py-2">{r.city_branches?.name || r.country_branches?.name || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
