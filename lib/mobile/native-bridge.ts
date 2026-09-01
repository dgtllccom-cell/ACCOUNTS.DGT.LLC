"use client";

/**
 * Native bridge — the ONLY place the ERP web app talks to the Capacitor native
 * container (Android / iOS). Everything here is a no-op / graceful fallback when the
 * app runs as a normal website or PWA, so the same codebase serves web, PWA and the
 * native shells with zero forking of business logic.
 *
 * Design rules:
 *  - Only `@capacitor/core` is imported statically (it is a hard dependency and ships
 *    a web shim). Feature plugins (Camera, PushNotifications, Network, App, StatusBar,
 *    Keyboard, Share, Filesystem) are reached through `Capacitor.registerPlugin` so the
 *    web/tsc build never needs their npm packages — they are added only on the machine
 *    that runs `npx cap sync` (see docs/mobile-app-build-runbook.md).
 *  - No accounting / permission / scope logic here. The native app calls the SAME
 *    `/api/erp/**` endpoints with the SAME cookie session as the browser.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  try {
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}

// ---------------------------------------------------------------------------
// Camera / document capture
// ---------------------------------------------------------------------------
interface CameraPlugin {
  getPhoto(options: {
    quality?: number;
    allowEditing?: boolean;
    resultType: "dataUrl" | "uri" | "base64";
    source?: "CAMERA" | "PHOTOS" | "PROMPT";
    saveToGallery?: boolean;
  }): Promise<{ dataUrl?: string; base64String?: string; format: string; webPath?: string }>;
}
const Camera = /* lazy proxy */ registerPlugin<CameraPlugin>("Camera");

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/**
 * Capture a photo (camera or gallery) as a File, ready for the SAME upload flow the
 * web `<input type="file">` feeds. Returns `null` when not running natively — the
 * caller must then fall back to its own file input.
 */
export async function captureDocumentPhoto(opts?: { source?: "CAMERA" | "PHOTOS" | "PROMPT" }): Promise<File | null> {
  if (!isNativeApp()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 82,
      resultType: "dataUrl",
      source: opts?.source ?? "PROMPT",
      allowEditing: false,
      saveToGallery: false,
    });
    if (!photo?.dataUrl) return null;
    const ext = (photo.format || "jpeg").replace("jpg", "jpeg");
    return dataUrlToFile(photo.dataUrl, `capture-${Date.now()}.${ext}`);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Network / offline awareness
// ---------------------------------------------------------------------------
interface NetworkPlugin {
  getStatus(): Promise<{ connected: boolean; connectionType: string }>;
  addListener(
    event: "networkStatusChange",
    cb: (status: { connected: boolean; connectionType: string }) => void
  ): Promise<{ remove: () => void }> | { remove: () => void };
}
const Network = registerPlugin<NetworkPlugin>("Network");

/** Subscribe to connectivity. On web it uses the browser online/offline events. */
export function watchConnectivity(onChange: (online: boolean) => void): () => void {
  if (!isNativeApp()) {
    const on = () => onChange(true);
    const off = () => onChange(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    onChange(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }
  let handle: { remove: () => void } | null = null;
  Network.getStatus().then((s) => onChange(s.connected)).catch(() => onChange(true));
  Promise.resolve(Network.addListener("networkStatusChange", (s) => onChange(s.connected)))
    .then((h) => {
      handle = h as { remove: () => void };
    })
    .catch(() => {});
  return () => handle?.remove();
}

// ---------------------------------------------------------------------------
// App lifecycle / Android hardware back button
// ---------------------------------------------------------------------------
interface AppPlugin {
  addListener(event: "backButton", cb: (data: { canGoBack: boolean }) => void): Promise<{ remove: () => void }> | { remove: () => void };
  exitApp(): Promise<void>;
}
const NativeApp = registerPlugin<AppPlugin>("App");

/**
 * Wire the Android hardware back button to browser history, and ask before exiting
 * at the app root. No-op on web / iOS.
 */
export function wireHardwareBackButton(): () => void {
  if (!isNativeApp() || nativePlatform() !== "android") return () => {};
  let handle: { remove: () => void } | null = null;
  Promise.resolve(
    NativeApp.addListener("backButton", ({ canGoBack }) => {
      const atRoot = ["/dashboard", "/dashboard/", "/login", "/"].includes(window.location.pathname);
      if (canGoBack && !atRoot) {
        window.history.back();
      } else {
        // simple double-back-to-exit could go here; keep it explicit for now
        NativeApp.exitApp().catch(() => {});
      }
    })
  )
    .then((h) => {
      handle = h as { remove: () => void };
    })
    .catch(() => {});
  return () => handle?.remove();
}

// ---------------------------------------------------------------------------
// Status bar theming (follows ERP light/dark + brand colour)
// ---------------------------------------------------------------------------
interface StatusBarPlugin {
  setStyle(options: { style: "DARK" | "LIGHT" | "DEFAULT" }): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
  setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
}
const StatusBar = registerPlugin<StatusBarPlugin>("StatusBar");

export async function themeNativeStatusBar(isDark: boolean, brandColor = "#0f3ea8"): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: isDark ? "DARK" : "LIGHT" });
    await StatusBar.setBackgroundColor({ color: isDark ? "#0b1220" : brandColor });
  } catch {
    /* StatusBar plugin not installed — ignore */
  }
}

// ---------------------------------------------------------------------------
// Push notifications — token registration only. Delivery/formatting is the
// server's existing /api/erp/mobile/push responsibility.
// ---------------------------------------------------------------------------
interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: string, cb: (data: any) => void): Promise<{ remove: () => void }> | { remove: () => void };
}
const Push = registerPlugin<PushPlugin>("PushNotifications");

/**
 * Register this device for push and hand the token to the existing ERP endpoint.
 * Safe to call on every native launch; the endpoint upserts by token.
 */
export async function initPushNotifications(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    let perm = await Push.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await Push.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await Push.addListener("registration", async (token: { value: string }) => {
      try {
        await fetch("/api/erp/mobile/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deviceToken: token.value,
            platform: nativePlatform() === "ios" ? "ios" : "android",
            deviceName: `${nativePlatform()} native app`,
          }),
        });
      } catch {
        /* offline — will re-register next launch */
      }
    });
    await Push.addListener("registrationError", () => {});
    await Push.register();
  } catch {
    /* PushNotifications plugin not installed — ignore */
  }
}
