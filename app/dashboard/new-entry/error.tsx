"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, LayoutDashboard, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewEntryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("New Entry module exception caught:", error);
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <UserCheck className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          New Entry & Journal Report Recovery Notice
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          This entry form or report module encountered a temporary chunk loading delay. Click below to reload fresh assets.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3.5 text-left font-mono text-[10.5px] text-indigo-300 overflow-x-auto border border-slate-800">
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
            className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 px-5 rounded-xl shadow-md"
          >
            <RefreshCcw className="h-4 w-4" /> Try Again (Reload)
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
