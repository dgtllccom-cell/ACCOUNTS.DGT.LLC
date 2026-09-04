"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

function readLangCookie(): SupportedLanguage {
  try {
    if (typeof document === "undefined") return "en";
    const match = document.cookie.match(/(?:^|;\s*)erp_lang=([^;]+)/);
    const v = match ? decodeURIComponent(match[1]) : "en";
    return (["en", "ur", "ar", "fa", "ps"] as const).includes(v as any) ? (v as SupportedLanguage) : "en";
  } catch {
    return "en";
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refId] = useState(() => "ERR-ROOT-" + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [lang] = useState<SupportedLanguage>(() => readLangCookie());
  const tt = (key: string, fallback: string) => t(lang, ("globalerr." + key) as never, fallback);

  useEffect(() => {
    console.error(`[GlobalError ${refId}] Root error boundary caught exception:`, error);

    const isChunkErr =
      error?.name === "ChunkLoadError" ||
      (error?.message &&
        (error.message.includes("Loading chunk") ||
          error.message.includes("timeout") ||
          error.message.includes("failed to fetch") ||
          error.message.includes("ChunkLoadError")));

    if (isChunkErr) {
      (async () => {
        try {
          if (typeof window !== "undefined") {
            const countKey = "erp_auto_chunk_cnt";
            const tsKey = "erp_auto_chunk_ts";
            const now = Date.now();
            const lastTs = parseInt(sessionStorage.getItem(tsKey) || "0", 10);
            let count = parseInt(sessionStorage.getItem(countKey) || "0", 10);

            if (now - lastTs > 15000) count = 0;

            if (count < 3) {
              sessionStorage.setItem(countKey, String(count + 1));
              sessionStorage.setItem(tsKey, String(now));
              if (window.isSecureContext && "serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) await r.unregister();
              }
              if ("caches" in window) {
                const keys = await caches.keys();
                for (const k of keys) await caches.delete(k);
              }
              const msg = String(error?.message || error || "");
              let targetRoute: string | null = null;
              try {
                const match = msg.match(/_next\/static\/chunks\/app(\/[^.\?]+?)(?:\/page|\/layout|\/route|-[a-f0-9]+|\.js)/i);
                if (match && match[1]) {
                  let r = match[1];
                  if (r.endsWith("/page")) r = r.slice(0, -5);
                  if (r.endsWith("/layout")) r = r.slice(0, -7);
                  if (r.endsWith("/route")) r = r.slice(0, -6);
                  targetRoute = r || "/dashboard";
                }
              } catch (e) {}
              const dest = targetRoute || window.location.pathname;
              const cleanDest = dest.replace(/\/page$/, "");
              window.location.replace(cleanDest + (cleanDest.includes("?") ? "&" : "?") + "_v=" + now);
            }
          }
        } catch {}
      })();
    }
  }, [error, refId]);

  const handleHardReload = () => {
    try {
      if (typeof window !== "undefined") {
        try { sessionStorage.removeItem("chunk_reload_attempt"); } catch {}
        if (typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
          }).catch(() => {});
        }
        if ("caches" in window) {
          caches.keys().then((keys) => {
            keys.forEach((k) => caches.delete(k));
          });
        }
      }
    } catch {}
    window.location.href = window.location.href;
  };

  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";

  return (
    <html lang={lang} dir={isRtl ? "rtl" : "ltr"}>
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#0f172a", color: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: "480px", width: "90%", margin: "auto", padding: "2rem", backgroundColor: "#1e293b", borderRadius: "1rem", border: "1px solid #334155", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ width: "48px", height: "48px", margin: "0 auto 1rem", borderRadius: "1rem", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
            ⚠️
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#94a3b8", marginBottom: "8px" }}>
            {tt("reference_id", "Reference ID:")} {refId}
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, marginBottom: "0.5rem" }}>
            {tt("diagnostic_notice", "Application Diagnostic Notice")}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1rem" }}>
            {tt("exception_occurred", "A client-side execution exception occurred. Details:")}
          </p>

          <div style={{ textAlign: "left", backgroundColor: "#090d16", padding: "12px", borderRadius: "8px", border: "1px solid #1e293b", fontSize: "11px", fontFamily: "monospace", color: "#f87171", marginBottom: "1.5rem", overflowX: "auto", maxHeight: "140px" }}>
            <strong>{error?.name}: {error?.message}</strong>
            {error?.stack && (
              <pre style={{ margin: "8px 0 0 0", fontSize: "10px", opacity: 0.8, whiteSpace: "pre-wrap" }}>{error.stack}</pre>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleHardReload}
              style={{ flex: 1, padding: "0.75rem", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "0.75rem", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              🔄 {tt("update_reload", "Update App & Reload")}
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{ flex: 1, padding: "0.75rem", backgroundColor: "transparent", color: "#cbd5e1", border: "1px solid #475569", borderRadius: "0.75rem", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              🏠 {tt("dashboard", "Dashboard")}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
