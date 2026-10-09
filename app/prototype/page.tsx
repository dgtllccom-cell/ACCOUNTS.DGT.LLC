"use client";

import { useMemo, useState } from "react";

type DeviceKey = "auto" | "desktop" | "iphone390" | "iphone430" | "samsung360" | "ipad768" | "ipad834";

const DEVICES: Record<DeviceKey, { label: string; width: number | null; height: number | null }> = {
  auto: { label: "Auto / Current Device", width: null, height: null },
  desktop: { label: "Desktop / Laptop", width: 1440, height: 900 },
  iphone390: { label: "iPhone 390", width: 390, height: 844 },
  iphone430: { label: "iPhone Pro Max 430", width: 430, height: 932 },
  samsung360: { label: "Samsung / Android 360", width: 360, height: 800 },
  ipad768: { label: "iPad 768", width: 768, height: 1024 },
  ipad834: { label: "iPad Pro 834", width: 834, height: 1194 },
};

export default function PrototypePreviewPage() {
  const [device, setDevice] = useState<DeviceKey>("auto");
  const [path, setPath] = useState("/dashboard");
  const spec = DEVICES[device];
  const src = useMemo(() => path || "/dashboard", [path]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2">
          <div className="mr-2">
            <div className="text-sm font-extrabold tracking-wide">DGT ERP FULL UI PROTOTYPE</div>
            <div className="text-[10px] text-emerald-400">DESIGN / REVIEW ONLY - NO LIVE WRITES</div>
          </div>

          <label className="text-xs text-slate-300">Device</label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as DeviceKey)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            {Object.entries(DEVICES).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>

          <label className="ml-2 text-xs text-slate-300">ERP route</label>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setPath((v) => v.trim() || "/dashboard");
            }}
            className="min-w-[280px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
            placeholder="/dashboard"
          />
          <button
            type="button"
            onClick={() => setPath((v) => v.trim() || "/dashboard")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900"
          >
            Open Full Window
          </button>
        </div>
      </header>

      <section className="flex min-h-[calc(100vh-58px)] justify-center overflow-auto bg-slate-900 p-3">
        <div
          className="overflow-hidden rounded-xl border border-slate-700 bg-white shadow-2xl"
          style={{
            width: spec.width ? `${spec.width}px` : "100%",
            height: spec.height ? `${spec.height}px` : "calc(100vh - 82px)",
            maxWidth: "100%",
          }}
        >
          <iframe
            key={`${device}:${src}`}
            src={src}
            title="DGT ERP prototype preview"
            className="h-full w-full border-0 bg-white"
          />
        </div>
      </section>
    </main>
  );
}
