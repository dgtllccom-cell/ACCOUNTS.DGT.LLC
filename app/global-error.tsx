"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Root Error Boundary caught exception:", error);

    const isChunkErr =
      error?.name === "ChunkLoadError" ||
      (error?.message &&
        (error.message.includes("Loading chunk") ||
          error.message.includes("timeout") ||
          error.message.includes("failed to fetch") ||
          error.message.includes("ChunkLoadError")));

    if (isChunkErr) {
      const lastReload = sessionStorage.getItem("chunk_reload_attempt");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem("chunk_reload_attempt", now.toString());
        window.location.reload();
      }
    }
  }, [error]);

  const handleHardReload = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("chunk_reload_attempt");
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

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#0f172a", color: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyCenter: "center" }}>
        <div style={{ maxWidth: "420px", margin: "auto", padding: "2rem", backgroundColor: "#1e293b", borderRadius: "1rem", border: "1px solid #334155", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ width: "48px", height: "48px", margin: "0 auto 1rem", borderRadius: "1rem", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, marginBottom: "0.5rem" }}>
            Application Update Needed
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            A new application update or script reload is required. Click below to refresh your session.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleHardReload}
              style={{ flex: 1, padding: "0.75rem", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "0.75rem", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              🔄 Update App & Reload
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{ flex: 1, padding: "0.75rem", backgroundColor: "transparent", color: "#cbd5e1", border: "1px solid #475569", borderRadius: "0.75rem", fontWeight: "bold", fontSize: "0.85rem", cursor: "pointer" }}
            >
              🏠 Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
