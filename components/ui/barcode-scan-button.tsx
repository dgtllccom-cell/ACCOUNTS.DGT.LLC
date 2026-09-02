"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { isNativeApp } from "@/lib/mobile/native-bridge";

/**
 * Camera barcode/QR scanner button. Uses the browser BarcodeDetector API
 * (Chrome / Android WebView / Capacitor) when available; on unsupported
 * browsers it stays hidden and the user just types the code. No external
 * library, CSP-safe.
 */
export function BarcodeScanButton({ onScan, className }: { onScan: (code: string) => void; className?: string }) {
  const lang = useActiveLanguage();
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const hasDetector = typeof (globalThis as any).BarcodeDetector === "function";
    const hasCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    setSupported((hasDetector && hasCamera) || isNativeApp());
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setOpen(false);
  }, []);

  const start = useCallback(async () => {
    setErr(null);
    setOpen(true);
    try {
      const Detector = (globalThis as any).BarcodeDetector;
      if (typeof Detector !== "function") {
        setErr(t(lang, "prodm.scan_unavailable", "Camera scanning is not available on this device — type the code instead."));
        return;
      }
      const detector = new Detector({
        formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "code_39"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const tick = async () => {
        if (!streamRef.current || !video.videoWidth) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length && codes[0].rawValue) {
            onScan(String(codes[0].rawValue).trim());
            stop();
            return;
          }
        } catch {
          /* frame not ready */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setErr(e?.message || t(lang, "prodm.scan_unavailable", "Camera scanning is not available on this device — type the code instead."));
    }
  }, [lang, onScan, stop]);

  useEffect(() => () => stop(), [stop]);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={className || "inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold"}
        aria-label={t(lang, "prodm.scan", "Scan")}
      >
        <ScanLine className="h-3.5 w-3.5" />
        {t(lang, "prodm.scan", "Scan")}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
          <button type="button" onClick={stop} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <video ref={videoRef} className="max-h-[70vh] w-full max-w-md rounded-xl" playsInline muted />
          {err ? <p className="mt-3 max-w-md text-center text-sm text-amber-300">{err}</p> : null}
        </div>
      ) : null}
    </>
  );
}
