/**
 * Shared voice-capability detection for every ERP Voice Entry control.
 *
 * Browsers block the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * and getUserMedia on an INSECURE context — i.e. plain `http://` on anything other
 * than localhost. When the ERP is opened on the LAN over `http://<ip>:<port>` the
 * mic request is rejected with a generic "permission denied" that the user can
 * never grant. This helper lets every voice control distinguish that case (open
 * the https link) from a genuine unsupported browser or a real permission denial,
 * so the UI can show the correct, actionable message instead.
 *
 * Pure client-side detection — safe to import anywhere; all functions guard for SSR.
 */

export type VoiceBlockReason = "insecure" | "unsupported" | null;

/** The browser's SpeechRecognition constructor, or null when the API is absent. */
export function getSpeechRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** Loopback / development hosts the browser treats as a secure context over http. */
export function isLocalhostName(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * True when the browser will permit mic / speech APIs: an HTTPS page, or a
 * localhost development origin. Relies on the native `window.isSecureContext`
 * flag first (the browser's own source of truth) and falls back to inspecting
 * the protocol/host when that flag is unavailable.
 */
export function isSecureVoiceContext(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.isSecureContext === "boolean") return window.isSecureContext;
  const loc = window.location;
  if (!loc) return false;
  return loc.protocol === "https:" || loc.protocol === "file:" || isLocalhostName(loc.hostname);
}

/** True when the browser exposes getUserMedia for raw audio capture. */
export function hasMediaCapture(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

/**
 * Resolve whether voice can run in the current context.
 *  - `insecure`    — blocked because the page is plain http on a non-localhost host
 *  - `unsupported` — the required API (SpeechRecognition and/or getUserMedia) is missing
 *  - ok            — voice may be attempted (a real permission prompt may still follow)
 *
 * Insecure context is checked first because on an http LAN origin the APIs may be
 * missing *or* present-but-blocked; either way the actionable fix is the https link.
 */
export function resolveVoiceSupport(opts?: {
  requireSpeechRecognition?: boolean;
  requireMediaCapture?: boolean;
}): { ok: boolean; reason: VoiceBlockReason } {
  const requireSR = opts?.requireSpeechRecognition ?? true;
  const requireMedia = opts?.requireMediaCapture ?? false;
  if (!isSecureVoiceContext()) return { ok: false, reason: "insecure" };
  if (requireSR && !getSpeechRecognitionCtor()) return { ok: false, reason: "unsupported" };
  if (requireMedia && !hasMediaCapture()) return { ok: false, reason: "unsupported" };
  return { ok: true, reason: null };
}
