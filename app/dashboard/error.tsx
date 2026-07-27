"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Runtime Exception:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
        ERP Component Runtime Exception
      </h2>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        A client-side exception occurred while rendering this module. You can reload the page or return to the dashboard.
      </p>

      {error?.message && (
        <div className="mt-4 max-w-lg rounded-lg border border-slate-200 bg-slate-50 p-3 text-left font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {error.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => reset()}
          className="gap-2 bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
          className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
        >
          <Home className="h-4 w-4" />
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
