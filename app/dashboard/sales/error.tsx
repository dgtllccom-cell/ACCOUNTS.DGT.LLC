"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, CircleDollarSign, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sales module exception caught:", error);
  }, [error]);

  const handleRetry = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("chunk_reload_attempt");
        sessionStorage.removeItem("erp_chunk_reload_timestamp");
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith("chunk_reload") || key.startsWith("erp_chunk_reload"))) {
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch {}
    reset();
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-xl mx-auto my-12 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <CircleDollarSign className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Sales Module Recovery Notice
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The sales booking module encountered a temporary exception. Click below to reload the sales form.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3.5 text-left font-mono text-[10.5px] text-emerald-300 overflow-x-auto border border-slate-800">
            {typeof error.message === "string"
              ? error.message
              : typeof error === "string"
              ? error
              : JSON.stringify(error)}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={handleRetry}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 px-5 rounded-xl shadow-md"
          >
            <RefreshCcw className="h-4 w-4" /> Reload Sales Module
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
            className="h-10 font-bold text-xs gap-2 px-5 rounded-xl border-slate-300 dark:border-slate-700"
          >
            <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
