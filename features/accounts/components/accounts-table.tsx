"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  kind?: string;
  account_type?: string;
  currency?: string;
  status?: string;
  is_active?: boolean;
};

export function AccountsTable() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<any>("/api/erp/accounting/accounts");
      const list = res?.accounts || res?.data || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load live accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <section className="rounded-lg border bg-card" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-medium">{tt("acct.coa_title", "Chart of Accounts Foundation")}</h2>
          <p className="text-sm text-muted-foreground">
            {tt("acct.coa_subtitle", "Live database-driven master chart of accounts records.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAccounts}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {tt("common.refresh", "Refresh")}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <Th className="px-5 py-3 font-medium">Code</Th>
              <Th className="px-5 py-3 font-medium">Name</Th>
              <Th className="px-5 py-3 font-medium">Type</Th>
              <Th className="px-5 py-3 font-medium">Currency</Th>
              <Th className="px-5 py-3 font-medium">Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{tt("acct.loading", "Loading live accounts from database...")}</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-destructive">
                  {error}
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  {tt("acct.empty", "No account records found in live database.")}
                </td>
              </tr>
            ) : (
              accounts.map((row) => (
                <tr key={row.id || row.code} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold">{row.code || "-"}</td>
                  <td className="px-5 py-3 font-medium">{row.name || "-"}</td>
                  <td className="px-5 py-3">{row.kind || row.account_type || "Asset"}</td>
                  <td className="px-5 py-3">{row.currency || "USD"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.is_active !== false && row.status !== "Inactive"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {row.is_active !== false && row.status !== "Inactive" ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
