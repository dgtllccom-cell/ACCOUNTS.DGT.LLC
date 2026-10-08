"use client";

import { useEffect, useMemo, useState } from "react";

type Device = "auto" | "desktop" | "iphone" | "samsung" | "ipad";

const DEVICES: Array<{ id: Device; label: string; width: number | null }> = [
  { id: "auto", label: "Auto / Current Device", width: null },
  { id: "desktop", label: "Desktop", width: 1440 },
  { id: "iphone", label: "iPhone", width: 390 },
  { id: "samsung", label: "Samsung", width: 360 },
  { id: "ipad", label: "iPad", width: 834 },
];

export function PrototypePreviewShell({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE === "1";
  const [device, setDevice] = useState<Device>("auto");

  useEffect(() => {
    if (!enabled) return;
    try {
      const saved = localStorage.getItem("dgt_prototype_device") as Device | null;
      if (saved && DEVICES.some((d) => d.id === saved)) setDevice(saved);
    } catch {}
  }, [enabled]);

  const selected = useMemo(() => DEVICES.find((d) => d.id === device) ?? DEVICES[0], [device]);

  if (!enabled) return <>{children}</>;

  const choose = (value: Device) => {
    setDevice(value);
    try { localStorage.setItem("dgt_prototype_device", value); } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950">
      <div className="sticky top-0 z-[100000] flex h-12 items-center gap-3 border-b border-slate-300 bg-slate-950 px-4 text-white shadow-sm">
        <div className="shrink-0 text-xs font-black tracking-wide">DGT ERP <span className="font-medium text-slate-300">Design Prototype</span></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[10px] text-slate-400 sm:inline">Device</span>
          <select
            value={device}
            onChange={(e) => choose(e.target.value as Device)}
            className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none"
            aria-label="Prototype device"
          >
            {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-8 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      </div>

      <div className={selected.width ? "p-3" : ""}>
        <div
          className={selected.width ? "mx-auto overflow-auto rounded-xl border border-slate-300 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950" : ""}
          style={selected.width ? { width: `min(${selected.width}px, 100%)`, height: "calc(100vh - 72px)" } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
