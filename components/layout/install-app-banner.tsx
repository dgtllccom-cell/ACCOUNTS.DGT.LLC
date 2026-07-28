"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, Monitor, X, Share, PlusSquare, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running as installed app (standalone)
    const isAppStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isAppStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIphoneOrIpad);

    // Listen for PWA install prompt event on Android/Chrome/Windows
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check localStorage dismissal
    const wasDismissed = localStorage.getItem("erp_app_install_dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Do not render if running inside installed standalone PWA app or if user dismissed
  if (isStandalone || dismissed) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback guide if prompt is not available
      alert(
        "To install Digital Dock ERP App:\n\n1. Click your browser menu (⋮ or ⚙️)\n2. Select 'Install Digital Dock ERP' or 'Save to Desktop'."
      );
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("erp_app_install_dismissed", "true");
  };

  return (
    <>
      {/* ── Top Install Banner ── */}
      <div className="bg-gradient-to-r from-blue-900 via-[#06122d] to-indigo-950 text-white px-4 py-2.5 shadow-md border-b border-blue-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Smartphone className="h-4 w-4 text-blue-300" />
          </div>
          <div>
            <div className="font-extrabold flex items-center gap-2">
              <span>Install Digital Dock ERP Mobile &amp; Desktop App</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9.5px] font-mono">
                1-Click App
              </span>
            </div>
            <p className="text-[10.5px] text-blue-200/80 hidden sm:block">
              Download and add the app icon to your phone home screen or laptop desktop for direct 1-click access without opening a browser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            onClick={handleInstallClick}
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-3 rounded-lg gap-1.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            INSTALL APP NOW
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── iOS Installation Guide Modal ── */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-600" />
                Install on iPhone / iPad
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Follow these 2 simple steps to add the Digital Dock ERP App icon to your iPhone Home Screen:
            </p>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Tap the Share Button</span>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    Tap <Share className="h-3.5 w-3.5 text-blue-600 inline" /> at the bottom of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Tap Add to Home Screen</span>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    Scroll down and tap <PlusSquare className="h-3.5 w-3.5 text-blue-600 inline" /> &quot;Add to Home Screen&quot;.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 font-bold text-xs"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> GOT IT
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
