"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api/client";

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
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-medium">Chart of Accounts Foundation</h2>
          <p className="text-sm text-muted-foreground">
            Live database-driven master chart of accounts records.
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
            Refresh
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Currency</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading live accounts from database...</span>
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
                  No account records found in live database.
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
                      {row.is_active !== false && row.status !== "Inactive" ? "Active" : "Inactive"}
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
