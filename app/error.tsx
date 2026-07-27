"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught client-side application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
          Application Notice
        </h2>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
          The page encountered a temporary client-side processing issue. Please try refreshing or return to the dashboard.
        </p>
        {error?.message && (
          <div className="mt-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-left font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto max-h-28">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            onClick={() => reset()}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 font-bold text-xs gap-1.5"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Reload Page
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = "/dashboard"}
            className="flex-1 h-10 font-bold text-xs gap-1.5"
          >
            <Home className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
