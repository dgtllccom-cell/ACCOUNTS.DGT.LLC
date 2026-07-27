"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard client-side exception caught:", error);
  }, [error]);

  return (
    <div className="p-6 max-w-xl mx-auto my-12 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Module Temporary Exception
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          This dashboard module encountered a client-side data error. Click below to reload or return to dashboard summary.
        </p>
        {error?.message && (
          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-left font-mono text-[10.5px] text-rose-600 dark:text-rose-400 overflow-x-auto">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={() => reset()}
            className="h-9 bg-blue-600 hover:bg-blue-700 font-bold text-xs gap-1.5"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Try Again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = "/dashboard"}
            className="h-9 font-bold text-xs gap-1.5"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
