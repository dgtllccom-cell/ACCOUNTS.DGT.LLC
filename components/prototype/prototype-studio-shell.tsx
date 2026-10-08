"use client";

import { useMemo, useRef, useState } from "react";

type DeviceKey = "auto" | "desktop" | "laptop" | "iphone" | "iphoneMax" | "samsung" | "ipad" | "ipadLand";
type Lang = "en" | "ur" | "ar" | "fa" | "ps";

const DEVICES: Record<DeviceKey, { label: string; width?: number; height?: number }> = {
  auto: { label: "Auto / Current Device" },
  desktop: { label: "Desktop 1440 × 900", width: 1440, height: 900 },
  laptop: { label: "Laptop 1366 × 768", width: 1366, height: 768 },
  iphone: { label: "iPhone 390 × 844", width: 390, height: 844 },
  iphoneMax: { label: "iPhone Pro Max 430 × 932", width: 430, height: 932 },
  samsung: { label: "Samsung 412 × 915", width: 412, height: 915 },
  ipad: { label: "iPad 820 × 1180", width: 820, height: 1180 },
  ipadLand: { label: "iPad Landscape 1180 × 820", width: 1180, height: 820 },
};

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function PrototypeStudioShell() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [device, setDevice] = useState<DeviceKey>("auto");
  const [lang, setLang] = useState<Lang>("en");
  const [dark, setDark] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const selected = DEVICES[device];
  const frameStyle = useMemo(() => {
    if (!selected.width || !selected.height) return { width: "100%", height: "calc(100vh - 76px)" } as const;
    return { width: selected.width, height: selected.height } as const;
  }, [selected]);

  const refreshFrame = () => setFrameKey((k) => k + 1);

  const changeLanguage = (next: Lang) => {
    setLang(next);
    try { localStorage.setItem("erp_lang", next); } catch {}
    setCookie("erp_lang", next);
    refreshFrame();
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const mode = next ? "night" : "day";
    try { localStorage.setItem("erp_theme_mode", mode); } catch {}
    setCookie("erp_theme_mode", mode);
    refreshFrame();
  };

  const goHome = () => {
    try {
      if (frameRef.current) frameRef.current.src = "/dashboard";
    } catch {}
    refreshFrame();
  };

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950">
      <div className="sticky top-0 z-50 flex min-h-14 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-white shadow-lg">
        <div className="mr-auto flex items-center gap-2">
          <div className="rounded-md bg-white/10 px-2 py-1 text-sm font-black">DGT ERP</div>
          <span className="text-xs text-slate-300">App Prototype</span>
          <span className="hidden rounded-full border border-emerald-700 bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-300 sm:inline">
            DESIGN ONLY • NO LIVE WRITES
          </span>
        </div>

        <label className="flex items-center gap-1 text-xs text-slate-300">
          <span className="hidden sm:inline">Device</span>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as DeviceKey)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            {(Object.entries(DEVICES) as Array<[DeviceKey, (typeof DEVICES)[DeviceKey]]>).map(([key, d]) => (
              <option key={key} value={key}>{d.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-xs text-slate-300">
          <span className="hidden sm:inline">Language</span>
          <select
            value={lang}
            onChange={(e) => changeLanguage(e.target.value as Lang)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
          >
            <option value="en">English</option>
            <option value="ur">اردو</option>
            <option value="ar">العربية</option>
            <option value="fa">فارسی</option>
            <option value="ps">پښتو</option>
          </select>
        </label>

        <button onClick={toggleTheme} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800">
          {dark ? "Day" : "Night"}
        </button>
        <button onClick={goHome} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800">
          Home
        </button>
      </div>

      <div className="flex min-h-[calc(100vh-56px)] items-start justify-center overflow-auto p-2 sm:p-4">
        <div
          className={device === "auto" ? "w-full overflow-hidden bg-white shadow-xl" : "overflow-hidden rounded-2xl border-[6px] border-slate-900 bg-white shadow-2xl"}
          style={frameStyle}
        >
          <iframe
            key={frameKey}
            ref={frameRef}
            src="/dashboard"
            title="DGT ERP Full Prototype"
            className="h-full w-full border-0 bg-white"
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
