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
 * what React's hydration diffing compares.
 */

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

let currentLang: SupportedLanguage = "en";
let initialized = false;
let isEmitting = false;
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
  
  if (document.documentElement.lang !== lang) {
    document.documentElement.lang = lang;
  }
  const nextDir = isRtl ? "rtl" : "ltr";
  if (document.documentElement.dir !== nextDir) {
    document.documentElement.dir = nextDir;
  }
}

function emit() {
  if (isEmitting) return;
  isEmitting = true;
  try {
    const next = readLang();
    applyHtmlAttributes(next);
    if (next !== currentLang) {
      currentLang = next;
      listeners.forEach((l) => {
        try {
          l();
        } catch (err) {
          console.error("Language listener error:", err);
        }
      });
    }
  } finally {
    isEmitting = false;
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const initial = readLang();
  applyHtmlAttributes(initial);
  if (initial !== currentLang) {
    currentLang = initial;
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  
  window.addEventListener("storage", (e) => {
    if (e.key === "erp_lang") {
      emit();
    }
  });
  
  window.addEventListener("erp_language_changed", emit);
  
  if (document.documentElement) {
    const observer = new MutationObserver(() => {
      if (isEmitting) return;
      const parsed = (document.documentElement.lang || "").split("-")[0].toLowerCase();
      if (parsed && (LANGS as readonly string[]).includes(parsed) && parsed !== currentLang) {
        emit();
      }
    });
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
