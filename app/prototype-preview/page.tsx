"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DevicePreset = {
  id: string;
  label: string;
  width: number | null;
  height: number | null;
};

const DEVICES: DevicePreset[] = [
  { id: "auto", label: "Auto / Current Device", width: null, height: null },
  { id: "desktop", label: "Desktop 1440", width: 1440, height: 900 },
  { id: "laptop", label: "Laptop 1280", width: 1280, height: 800 },
  { id: "ipad-pro", label: "iPad Pro 1024", width: 1024, height: 1180 },
  { id: "ipad", label: "iPad 834", width: 834, height: 1112 },
  { id: "iphone-max", label: "iPhone Pro Max 430", width: 430, height: 900 },
  { id: "iphone", label: "iPhone Pro 390", width: 390, height: 844 },
  { id: "samsung", label: "Samsung 360", width: 360, height: 800 },
  { id: "android-large", label: "Samsung / Android 412", width: 412, height: 880 },
];

const LANGS = [
  ["en", "English"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["fa", "Farsi"],
  ["ps", "Pashto"],
] as const;

export default function PrototypePreviewPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [deviceId, setDeviceId] = useState("auto");
  const [lang, setLang] = useState("en");
  const [dark, setDark] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    try {
      setDeviceId(localStorage.getItem("dgt_proto_device") || "auto");
      setLang(localStorage.getItem("erp_lang") || "en");
      setDark((localStorage.getItem("erp_theme_mode") || "day") === "night");
    } catch {}
  }, []);

  const device = useMemo(
    () => DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0],
    [deviceId],
  );

  const reloadFrame = () => setFrameKey((v) => v + 1);

  const selectDevice = (id: string) => {
    setDeviceId(id);
    try { localStorage.setItem("dgt_proto_device", id); } catch {}
  };

  const selectLanguage = (value: string) => {
    setLang(value);
    try {
      localStorage.setItem("erp_lang", value);
      document.cookie = `erp_lang=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      const w = iframeRef.current?.contentWindow;
      w?.localStorage.setItem("erp_lang", value);
    } catch {}
    reloadFrame();
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const mode = next ? "night" : "day";
    try {
      localStorage.setItem("erp_theme_mode", mode);
      document.cookie = `erp_theme_mode=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
      iframeRef.current?.contentWindow?.localStorage.setItem("erp_theme_mode", mode);
    } catch {}
    reloadFrame();
  };

  const goHome = () => {
    try {
      if (iframeRef.current) iframeRef.current.src = "/dashboard/super-admin";
    } catch {
      reloadFrame();
    }
  };

  const auto = device.width == null;
  const frameStyle: React.CSSProperties = auto
    ? { width: "100%", height: "calc(100vh - 52px)" }
    : {
        width: device.width ?? 1440,
        height: Math.min(device.height ?? 900, 900),
        minHeight: 640,
      };

  return (
    <main className="min-h-screen bg-slate-200 dark:bg-slate-950">
      <header className="sticky top-0 z-[100000] flex h-[52px] items-center gap-3 border-b border-slate-700 bg-slate-950 px-3 text-white shadow-lg">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <div className="rounded-md bg-cyan-600 px-2 py-1 text-xs font-black">DGT ERP</div>
          <span className="hidden truncate text-xs text-slate-300 sm:inline">Full UI Design Prototype</span>
        </div>

        <label className="flex items-center gap-1 text-[11px] text-slate-300">
          <span className="hidden md:inline">Device</span>
          <select
            value={deviceId}
            onChange={(e) => selectDevice(e.target.value)}
            className="h-8 max-w-[190px] rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-1 text-[11px] text-slate-300">
          <span className="hidden md:inline">Language</span>
          <select
            value={lang}
            onChange={(e) => selectLanguage(e.target.value)}
            className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            {LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>

        <button type="button" onClick={toggleTheme} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs hover:bg-slate-800">
          {dark ? "Day" : "Night"}
        </button>
        <button type="button" onClick={goHome} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs hover:bg-slate-800">
          Home
        </button>
      </header>

      <section className={auto ? "w-full" : "mx-auto flex justify-center overflow-auto p-3"}>
        <div
          className={auto ? "w-full" : "overflow-hidden rounded-xl border border-slate-400 bg-white shadow-2xl"}
          style={auto ? undefined : { width: device.width ?? 1440 }}
        >
          {!auto ? (
            <div className="flex h-6 items-center justify-center bg-slate-900 text-[10px] font-semibold text-slate-300">
              {device.label} • responsive preview
            </div>
          ) : null}
          <iframe
            key={frameKey}
            ref={iframeRef}
            src="/dashboard/super-admin"
            title="DGT ERP Full UI Prototype"
            className="block border-0 bg-white"
            style={frameStyle}
          />
        </div>
      </section>
    </main>
  );
}
