"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw, Home, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refId] = useState(() => "ERR-APP-" + Math.random().toString(36).substring(2, 8).toUpperCase());

  const isChunkError =
    error?.name === "ChunkLoadError" ||
    (error?.message &&
      (error.message.includes("Loading chunk") ||
        error.message.includes("failed to fetch") ||
        error.message.includes("Failed to fetch dynamically imported module") ||
        error.message.includes("error loading chunk") ||
        error.message.includes("client-side exception has occurred") ||
        error.message.includes("ChunkLoadError")));

  useEffect(() => {
    console.error(`[GlobalClientError ${refId}] Uncaught client-side application error:`, error);

    if (isChunkError) {
      try {
        const lastReload = sessionStorage.getItem("chunk_reload_attempt");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem("chunk_reload_attempt", now.toString());
          window.location.reload();
        }
      } catch {}
    }
  }, [error, isChunkError, refId]);

  const handleHardReload = async () => {
    setIsUpdating(true);
    try {
      if (typeof window !== "undefined") {
        try { sessionStorage.removeItem("chunk_reload_attempt"); } catch {}
        if (window.isSecureContext && "serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to clear service worker caches:", e);
    }
    window.location.href = window.location.href;
  };

  const handleCopyDiagnostic = () => {
    const text = `Error Ref ID: ${refId}\nName: ${error?.name}\nMessage: ${error?.message}\nStack: ${error?.stack || "N/A"}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div>
          <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300">
            Reference ID: {refId}
          </span>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white mt-2">
            {isChunkError ? "Application Update Needed" : "Client Diagnostic Error"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {isChunkError
              ? "A fresh version of Digital Dock ERP is available or script chunks require updating. Click below to refresh your session."
              : "The page encountered a client-side execution error. Technical details are displayed below for resolution."}
          </p>
        </div>

        {/* Detailed Error Box */}
        <div className="rounded-xl bg-slate-900 text-slate-100 p-4 text-left font-mono text-[11px] space-y-1.5 overflow-x-auto max-h-48 border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-amber-400 border-b border-slate-800 pb-1">
            <span>{error?.name || "Error"}</span>
            <button onClick={handleCopyDiagnostic} className="hover:text-white flex items-center gap-1">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy Diagnostic"}
            </button>
          </div>
          <p className="font-bold text-rose-300">{error?.message || "Unknown client error"}</p>
          {error?.stack && (
            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap opacity-90">{error.stack}</pre>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            onClick={handleHardReload}
            disabled={isUpdating}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 font-bold text-xs gap-1.5 text-white"
          >
            <RefreshCcw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
            {isChunkError ? "Update App & Reload" : "Hard Reload Page"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
            className="flex-1 h-11 font-bold text-xs gap-1.5"
          >
            <Home className="h-4 w-4" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
