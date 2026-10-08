"use client";

import { useMemo, useState } from "react";

type Device = "desktop" | "iphone" | "samsung" | "ipad";

const DEVICES: Array<{ id: Device; label: string; width: number | null; height: number | null }> = [
  { id: "desktop", label: "Computer", width: null, height: null },
  { id: "iphone", label: "iPhone", width: 390, height: 844 },
  { id: "samsung", label: "Samsung", width: 430, height: 900 },
  { id: "ipad", label: "iPad", width: 834, height: 1112 },
];

export default function PrototypeReviewPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const active = useMemo(() => DEVICES.find((d) => d.id === device) ?? DEVICES[0], [device]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2">
          <div className="mr-3">
            <div className="text-sm font-black tracking-tight">DGT ERP Design Prototype</div>
            <div className="text-[10px] text-emerald-300">DESIGN / REVIEW ONLY - NO LIVE WRITES</div>
          </div>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-bold transition " +
                (device === d.id
                  ? "border-cyan-400 bg-cyan-500 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500")
              }
            >
              {d.label}
            </button>
          ))}
          <a
            href="/dashboard"
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-500"
          >
            Open Full Screen
          </a>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-58px)] items-start justify-center overflow-auto bg-slate-900 p-3 sm:p-5">
        <div
          className="overflow-hidden bg-white shadow-2xl ring-1 ring-white/10"
          style={{
            width: active.width ? `${active.width}px` : "100%",
            height: active.height ? `${active.height}px` : "calc(100vh - 92px)",
            maxWidth: "100%",
            borderRadius: active.id === "desktop" ? 12 : 28,
          }}
        >
          <iframe
            key={device}
            title={`DGT ERP ${active.label} Prototype`}
            src="/dashboard"
            className="h-full w-full border-0 bg-white"
          />
        </div>
      </div>
    </main>
  );
}
