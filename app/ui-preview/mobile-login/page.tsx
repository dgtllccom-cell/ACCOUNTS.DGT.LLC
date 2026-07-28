"use client";

import React, { useState } from "react";
import { Smartphone, Tablet, Monitor, CheckCircle2, ShieldCheck, Server, Globe2 } from "lucide-react";
import { LoginForm } from "@/features/auth/components/login-form";

type DeviceMode = "iphone" | "android" | "ipad" | "desktop";

export default function MobileLoginPreviewPage() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("iphone");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 space-y-6">
      
      {/* ═══════ TOP BANNER BAR ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>UI Preview</span><span>›</span><span>Auth Portal</span><span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">Mobile & Device Responsive Login</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Smartphone className="h-7 w-7 text-blue-600" />
            Digital Dock ERP Mobile & Tablet Login Preview
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Test and preview the responsive ERP login screen across iPhone, Android, iPad, and Desktop screens.
          </p>
        </div>

        {/* Device Switcher Pills */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setDeviceMode("iphone")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              deviceMode === "iphone"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Smartphone className="h-4 w-4" /> iPhone 15 Pro (393px)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("android")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              deviceMode === "android"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Smartphone className="h-4 w-4 text-emerald-400" /> Samsung S24 (412px)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("ipad")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              deviceMode === "ipad"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Tablet className="h-4 w-4" /> iPad Pro (768px)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("desktop")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              deviceMode === "desktop"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Monitor className="h-4 w-4" /> Desktop (1440px)
          </button>
        </div>
      </div>

      {/* ═══════ DEVICE FRAME PREVIEW CONTAINER ═══════ */}
      <div className="flex justify-center items-center py-6 min-h-[750px]">
        {/* iPhone 15 Pro Frame */}
        {deviceMode === "iphone" && (
          <div className="w-[393px] min-h-[812px] bg-slate-900 rounded-[50px] p-4 shadow-2xl border-[10px] border-slate-800 relative">
            {/* Dynamic Island / Notch */}
            <div className="w-32 h-6 bg-black rounded-full mx-auto mb-4 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-800 mr-2" />
              <div className="h-3 w-3 rounded-full bg-blue-900/60" />
            </div>

            {/* Screen Content Area */}
            <div className="bg-white dark:bg-slate-950 rounded-[38px] p-5 h-full overflow-y-auto shadow-inner text-slate-900 dark:text-slate-100 flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs">
                  DB
                </div>
                <div>
                  <div className="text-xs font-black tracking-widest text-slate-900 dark:text-white">DAMAN</div>
                  <div className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">Business Group</div>
                </div>
              </div>

              {/* Login Form */}
              <LoginForm />

              {/* Home Bar Indicator */}
              <div className="w-32 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-6" />
            </div>
          </div>
        )}

        {/* Samsung S24 Frame */}
        {deviceMode === "android" && (
          <div className="w-[412px] min-h-[820px] bg-slate-950 rounded-[44px] p-4 shadow-2xl border-[8px] border-slate-800 relative">
            {/* Punchhole Camera */}
            <div className="w-4 h-4 bg-black rounded-full mx-auto mb-3 flex items-center justify-center" />

            {/* Screen Content Area */}
            <div className="bg-white dark:bg-slate-950 rounded-[32px] p-5 h-full overflow-y-auto shadow-inner text-slate-900 dark:text-slate-100 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-xs">
                  ERP
                </div>
                <div>
                  <div className="text-xs font-black tracking-widest text-slate-900 dark:text-white">DAMAN GROUP</div>
                  <div className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">Enterprise System</div>
                </div>
              </div>

              <LoginForm />
            </div>
          </div>
        )}

        {/* iPad Pro Frame */}
        {deviceMode === "ipad" && (
          <div className="w-[720px] min-h-[850px] bg-slate-900 rounded-[36px] p-6 shadow-2xl border-[12px] border-slate-800 relative">
            <div className="bg-white dark:bg-slate-950 rounded-[24px] p-8 h-full overflow-y-auto shadow-inner text-slate-900 dark:text-slate-100 max-w-md mx-auto my-auto flex flex-col justify-center">
              <LoginForm />
            </div>
          </div>
        )}

        {/* Desktop View */}
        {deviceMode === "desktop" && (
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4 p-6 bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl text-white">
                    DHT
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Digital Dock ERP</h2>
                    <p className="text-xs text-blue-200">Global Enterprise Portal</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-blue-100/80 pt-4 border-t border-white/10">
                  Multi-country enterprise resource planning system connecting Pakistan, UAE, Afghanistan, Iran, and Saudi Arabia branches in real time.
                </p>
                <div className="pt-4 flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Server className="h-4 w-4" /> Production Server Connected: 72.60.209.121
                </div>
              </div>

              <div className="p-4">
                <LoginForm />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
