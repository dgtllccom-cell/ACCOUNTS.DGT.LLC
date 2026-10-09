"use client";

import { useEffect, useState } from "react";

type Device = "auto" | "desktop" | "iphone" | "samsung" | "ipad";

const WIDTHS: Record<Device, string> = {
  auto: "100%",
  desktop: "1440px",
  iphone: "390px",
  samsung: "412px",
  ipad: "834px",
};

export function PrototypeDeviceToolbar() {
  const enabled = process.env.NEXT_PUBLIC_DGT_PROTOTYPE_MODE === "1";
  const [device, setDevice] = useState<Device>("auto");

  useEffect(() => {
    if (!enabled) return;
    const saved = (localStorage.getItem("dgt_proto_device") as Device | null) ?? "auto";
    if (saved in WIDTHS) setDevice(saved);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    localStorage.setItem("dgt_proto_device", device);
    document.documentElement.style.setProperty("--dgt-prototype-width", WIDTHS[device]);
    document.documentElement.dataset.dgtPrototypeDevice = device;
  }, [device, enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed left-1/2 top-2 z-[100000] -translate-x-1/2 rounded-2xl border border-slate-300 bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <div className="flex items-center gap-1 text-[11px] font-semibold">
        {([
          ["auto", "Auto"],
          ["desktop", "Desktop"],
          ["iphone", "iPhone"],
          ["samsung", "Samsung"],
          ["ipad", "iPad"],
        ] as Array<[Device, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDevice(id)}
            className={
              "rounded-xl px-3 py-1.5 transition " +
              (device === id
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
