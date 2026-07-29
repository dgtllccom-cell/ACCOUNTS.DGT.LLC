"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, Monitor, X, Share, PlusSquare, CheckCircle2, ShieldCheck, FileCheck, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register Service Worker if available on secure contexts (HTTPS or localhost)
    if (typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } catch {}
    }

    // Check if already running as installed app (standalone)
    const isAppStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);

    setIsStandalone(isAppStandalone);

    // Detect iOS
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent.toLowerCase() : "";
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIphoneOrIpad);

    // Listen for PWA install prompt event on Android/Chrome/Windows
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check localStorage dismissal
    const wasDismissed = typeof window !== "undefined" ? localStorage.getItem("erp_app_install_dismissed") : null;
    if (wasDismissed) {
      setDismissed(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Do not render if running inside installed standalone PWA app or if user dismissed
  if (isStandalone || dismissed) return null;

  const downloadDesktopShortcut = (type: "installer" | "shortcut" | "cmd" = "installer") => {
    try {
      const downloadUrl = `/api/download/app?type=${type}&t=${Date.now()}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      if (type === "installer") link.download = "Install-Digital-Dock-ERP.bat";
      else if (type === "cmd") link.download = "Digital-Dock-ERP-Launcher.cmd";
      else link.download = "Digital Dock ERP.url";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Fallback inline download
      const origin = typeof window !== "undefined" ? window.location.origin : "http://72.60.209.121";
      const urlContent = `[InternetShortcut]\nURL=${origin}/auth/login\nIconIndex=0\nIconFile=${origin}/icons/digital-dock-icon.svg\n`;
      const blob = new Blob([urlContent], { type: "application/x-mswinurl" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Digital Dock ERP.url";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    // 1. Immediately trigger automatic file download directly into the user's computer
    downloadDesktopShortcut("installer");

    // 2. Trigger native browser PWA install dialog if supported by Chrome/Edge
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch {
        setShowDesktopGuide(true);
      }
    } else {
      setShowDesktopGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("erp_app_install_dismissed", "true");
    }
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
                Automatic Download Ready
              </span>
            </div>
            <p className="text-[10.5px] text-blue-200/80 hidden sm:block">
              Click below to automatically download the app installer directly into your computer for 1-click desktop access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            onClick={handleInstallClick}
            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] px-3.5 rounded-lg gap-1.5 shadow-sm transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            DOWNLOAD &amp; INSTALL APP NOW
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
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> GOT IT
            </Button>
          </div>
        </div>
      )}

      {/* ── Automatic Download Success & Desktop App Modal ── */}
      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-emerald-600" />
                App Installer Downloaded Automatically
              </h3>
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Automatic Download Completed!</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                The 1-click desktop app installer (<strong>Install-Digital-Dock-ERP.bat</strong>) has been downloaded into your computer&apos;s Downloads folder.
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">How to complete setup on your PC:</span>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                <li>Go to your <strong>Downloads</strong> folder on your computer.</li>
                <li>Double-click <strong>Install-Digital-Dock-ERP.bat</strong>.</li>
                <li>It will automatically place a 1-click icon on your Desktop &amp; Start Menu!</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                onClick={() => downloadDesktopShortcut("installer")}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs gap-1.5 text-white"
              >
                <Zap className="h-4 w-4" /> RE-DOWNLOAD 1-CLICK INSTALLER (.BAT)
              </Button>
              <Button
                type="button"
                onClick={() => downloadDesktopShortcut("shortcut")}
                variant="outline"
                className="w-full h-9 border-slate-300 font-bold text-xs gap-1.5 text-slate-700 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" /> DOWNLOAD .URL DESKTOP ICON
              </Button>
              <Button
                type="button"
                onClick={() => downloadDesktopShortcut("cmd")}
                variant="outline"
                className="w-full h-9 border-slate-300 font-bold text-xs gap-1.5 text-slate-700 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" /> DOWNLOAD STANDALONE WINDOW (.CMD)
              </Button>
              <Button
                type="button"
                onClick={() => setShowDesktopGuide(false)}
                className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs mt-1"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" /> DONE
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
