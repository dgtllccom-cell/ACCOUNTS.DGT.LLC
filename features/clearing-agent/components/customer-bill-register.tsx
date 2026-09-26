"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCcw, Search, Receipt, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { CustomerBillManagementView } from "./customer-bill-management-view";
import type { CustomerBillRow } from "@/lib/services/clearing-customer-bill-service";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  approved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  posted: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

/**
 * Table-first wrapper for Customer Bills: shows the real bill register on
 * load, and only opens CustomerBillManagementView (which already supports
 * loading an existing bill via ?id=) after "+ New Bill" or a row click.
 */
export function CustomerBillRegister({ lang: langProp }: { lang?: SupportedLanguage }) {
  const router = useRouter();
  const lang = langProp ?? "en";
  const isRtl = getLanguageDirection(lang) === "rtl";
  const _ = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  const [rows, setRows] = useState<CustomerBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [openBillId, setOpenBillId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-bill", { cache: "no-store" });
      const json = await res.json();
      setRows(json.success && Array.isArray(json.data) ? json.data : []);
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
    return [r.bill_no, r.customer_name, r.order_no].some((v) => (v || "").toLowerCase().includes(q));
  });

  if (viewMode === "form") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            setViewMode("list");
            setOpenBillId(null);
            router.replace("/dashboard/clearing-agent/customer-bill");
            void loadRows();
          }}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {_("cbr.back_to_register", "Back to Bill Register")}
        </Button>
        <CustomerBillManagementView key={openBillId ?? "new"} />
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-[1680px] space-y-3 p-3">
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b py-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            <Receipt className="h-4 w-4" />
            {_("cbill.register_title", "Customer Bill Register")} ({filteredRows.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={_("cbr.search_ph", "Search bill no, customer, order...")}
                className="h-9 pl-9 text-xs"
              />
            </div>
            <JournalPrintButton
              title={_("cbill.register_title", "Customer Bill Register")}
              columns={[
                { key: "bill_no", label: _("cbr.col_bill_no", "Bill No"), align: "center" },
                { key: "customer_name", label: _("cbr.col_customer", "Customer") },
                { key: "order_no", label: _("cbr.col_order", "Order"), align: "center" },
                { key: "currency_code", label: _("common.currency", "Currency"), align: "center" },
                { key: "grand_total", label: _("cbr.col_total", "Grand Total"), align: "right", format: "number" },
                { key: "balance_due", label: _("cbr.col_balance", "Balance Due"), align: "right", format: "number" },
                { key: "status", label: _("common.status", "Status"), align: "center", format: "status" },
              ]}
              rows={filteredRows as unknown as Record<string, unknown>[]}
              fetchFullData={async () => {
                const all: CustomerBillRow[] = [];
                for (let offset = 0; offset < 20000; offset += 100) {
                  const res = await fetch(`/api/erp/clearing-agent/customer-bill?limit=100&offset=${offset}`, { cache: "no-store" });
                  const json = await res.json();
                  const page: CustomerBillRow[] = json.success && Array.isArray(json.data) ? json.data : [];
                  all.push(...page);
                  if (page.length < 100) break;
                }
                const q = query.trim().toLowerCase();
                return all.filter((r) => !q || [r.bill_no, r.customer_name, r.order_no].some((v) => (v || "").toLowerCase().includes(q))) as unknown as Record<string, unknown>[];
              }}
              filters={query.trim() ? [{ label: _("common.search", "Search"), value: query.trim() }] : []}
              orientation="landscape"
            />
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void loadRows()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={() => {
                setOpenBillId(null);
                setViewMode("form");
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {_("cbr.new_bill", "New Bill")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b bg-muted/50">
                <tr>
                  <Th className="px-3 py-2 font-black uppercase">{_("cbr.col_bill_no", "Bill No")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("cbr.col_customer", "Customer")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("cbr.col_order", "Order")}</Th>
                  <Th className="px-3 py-2 font-black uppercase text-right">{_("cbr.col_total", "Grand Total")}</Th>
                  <Th className="px-3 py-2 font-black uppercase text-right">{_("cbr.col_balance", "Balance Due")}</Th>
                  <Th className="px-3 py-2 font-black uppercase">{_("common.status", "Status")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {_("common.loading", "Loading...")}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {_("cbr.empty", "No customer bills found. Click \"New Bill\" to create one.")}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b hover:bg-muted/30"
                      onClick={() => {
                        setOpenBillId(r.id);
                        router.replace(`/dashboard/clearing-agent/customer-bill?id=${r.id}`);
                        setViewMode("form");
                      }}
                    >
                      <td className="px-3 py-2 font-mono font-semibold text-cyan-700 dark:text-cyan-300">{r.bill_no || "-"}</td>
                      <td className="px-3 py-2">{r.customer_name || "-"}</td>
                      <td className="px-3 py-2">{r.order_no || "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(r.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {r.currency_code}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(r.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[r.status] || STATUS_STYLES.draft}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
