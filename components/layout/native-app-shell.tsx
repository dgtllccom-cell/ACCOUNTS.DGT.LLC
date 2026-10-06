"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  isNativeApp,
  wireHardwareBackButton,
  initPushNotifications,
  themeNativeStatusBar,
  watchConnectivity,
} from "@/lib/mobile/native-bridge";

/**
 * Mounted once inside the dashboard shell. It is completely inert on the web / PWA
 * (every bridge call short-circuits when `isNativeApp()` is false) and only does work
 * inside the Android / iOS Capacitor containers:
 *   - status-bar theming that follows the ERP light/dark theme
 *   - Android hardware back-button → browser history
 *   - push-notification token registration (→ existing /api/erp/mobile/push)
 *   - a five-language offline banner
 */
export function NativeAppShell() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [online, setOnline] = useState(true);
  const native = isNativeApp();

  useEffect(() => {
    const stopConnectivity = watchConnectivity(setOnline);
    if (!native) return stopConnectivity;

    const stopBack = wireHardwareBackButton();
    void initPushNotifications();

    const dark = document.documentElement.classList.contains("dark");
    void themeNativeStatusBar(dark);
    const observer = new MutationObserver(() => {
      void themeNativeStatusBar(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stopConnectivity();
      stopBack();
      observer.disconnect();
    };
  }, [native]);

  if (!native || online) return null;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-center text-xs font-semibold text-white"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      {t(lang, "mbl.offline_banner", "You are offline — changes will sync when the connection returns.")}
    </div>
  );
}
