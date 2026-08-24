"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings module exception caught:", error);
    const msg = error?.message || String(error || "");
    if (msg.includes("Loading chunk") || msg.includes("ChunkLoadError") || msg.includes("Failed to fetch") || msg.includes("failed to fetch")) {
      const now = Date.now();
      const lastReload = parseInt(sessionStorage.getItem("last_auto_chunk_reload") || "0", 10);
      if (now - lastReload > 10000) {
        sessionStorage.setItem("last_auto_chunk_reload", String(now));
        window.location.reload();
      }
    }
  }, [error]);

  const handleRetry = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("chunk_reload_attempt");
        sessionStorage.removeItem("erp_chunk_reload_timestamp");
      }
    } catch {}
    reset();
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-xl mx-auto my-12 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Settings Module Recovery Notice
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The settings management module encountered a temporary server or client rendering exception. Click below to refresh the parameters.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3.5 text-left font-mono text-[10.5px] text-amber-300 overflow-x-auto border border-slate-800">
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
            className="h-10 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs gap-2 px-5 rounded-xl shadow-md"
          >
            <RefreshCcw className="h-4 w-4" /> Try Again (Reload)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (window.location.href = "/dashboard/settings")}
            className="h-10 font-bold text-xs gap-2 px-5 rounded-xl border-slate-300 dark:border-slate-700"
          >
            <SlidersHorizontal className="h-4 w-4" /> All Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
