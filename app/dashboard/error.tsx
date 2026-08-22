"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Route Exception:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 mb-4">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          Module Temporary Exception
        </h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          This dashboard module encountered a temporary chunk loading error after a system update. Click below to reload fresh assets.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950 text-left font-mono text-[10px] text-rose-400 overflow-x-auto">
            {error.message || "Unknown error"}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again (Reload)
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          >
            <LayoutDashboard className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
