"use client";

import { useSyncExternalStore } from "react";
import type { SupportedLanguage } from "./languages";

/**
 * Single source of truth for "what language is active right now", shared by every
 * consumer (useActiveLanguage() and the <Th> table-header component).
 *
 * Must use useSyncExternalStore, not useState(() => readLocalStorage()) — a lazy
 * useState initializer runs during the CLIENT's first render too, so it would read
 * localStorage/document.documentElement.lang immediately and return e.g. "ar" while
 * the server (which has no localStorage/document) always rendered "en". That mismatch
 * between what the server sent and what the client's first render expects is exactly
 * what React's hydration diffing compares — it does not resolve itself gracefully:
 * React logs a "Hydration failed" error and its recovery is per-node and inconsistent,
 * so some translated text ends up fixed and other text is silently left as the
 * server's stale English. useSyncExternalStore avoids this because getServerSnapshot
 * always returns "en" (matching SSR) and the real value is only applied after mount,
 * through the subscription — never during the initial render itself.
 */

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

let currentLang: SupportedLanguage = "en";
let initialized = false;
const listeners = new Set<() => void>();

function readLang(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const raw = (localStorage.getItem("erp_lang") || document.documentElement.lang || "en").trim();
  const base = raw.split("-")[0].toLowerCase();
  return (LANGS as readonly string[]).includes(base) ? (base as SupportedLanguage) : "en";
}

function applyHtmlAttributes(lang: SupportedLanguage) {
  if (typeof document === "undefined" || !document.documentElement) return;
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
}

function emit() {
  const next = readLang();
  applyHtmlAttributes(next);
  if (next !== currentLang) {
    currentLang = next;
    listeners.forEach((l) => l());
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const initial = readLang();
  applyHtmlAttributes(initial);
  if (initial !== currentLang) {
    currentLang = initial;
    // Notify synchronously-mounted subscribers once the real language is known —
    // ensureInit() runs inside subscribe(), which React calls right after commit,
    // so without this, components that mounted before any language-change event
    // would stay on "en" until something else happened to trigger emit().
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  window.addEventListener("storage", emit);
  window.addEventListener("erp_language_changed", emit);
  if (document.documentElement) {
    const observer = new MutationObserver(emit);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
}

function subscribe(cb: () => void) {
  ensureInit();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SupportedLanguage {
  return currentLang;
}

function getServerSnapshot(): SupportedLanguage {
  return "en";
}

export function useActiveLanguage(): SupportedLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
