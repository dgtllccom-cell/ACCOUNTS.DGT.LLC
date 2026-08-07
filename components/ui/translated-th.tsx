"use client";

import type { ReactNode, ThHTMLAttributes } from "react";
import { useSyncExternalStore } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";

/**
 * <Th> — a drop-in replacement for <th> that translates its header text into the
 * active language. Used everywhere table headers appear so column headings follow
 * the language selector automatically.
 *
 * Why a component (not a hook per table): there are 100+ table components. Swapping
 * `<th>` → `<Th>` is a safe, mechanical change, and because translateHeader() returns
 * unknown/`en` labels unchanged, wrapping every <th> (including data cells) is harmless.
 *
 * All language subscriptions share ONE set of global listeners (module-level store via
 * useSyncExternalStore), so rendering thousands of <Th> cells stays cheap.
 */

const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

let currentLang: SupportedLanguage = "en";
let initialized = false;
const listeners = new Set<() => void>();

function readLang(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const raw = (localStorage.getItem("erp_lang") || document.documentElement.lang || "en").trim();
  return (LANGS as readonly string[]).includes(raw) ? (raw as SupportedLanguage) : "en";
}

function emit() {
  const next = readLang();
  if (next !== currentLang) {
    currentLang = next;
    listeners.forEach((l) => l());
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  currentLang = readLang();
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

export function useHeaderLanguage(): SupportedLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };

export function Th({ children, ...props }: ThProps) {
  const lang = useHeaderLanguage();
  const content = typeof children === "string" ? translateHeader(lang, children) : children;
  return <th {...props}>{content}</th>;
}
