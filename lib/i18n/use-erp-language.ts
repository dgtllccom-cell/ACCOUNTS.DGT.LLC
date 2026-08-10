"use client";

import { useSyncExternalStore } from "react";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

export const ERP_LANGUAGE_CHANGE_EVENT = "erp-language-change";

function getLanguageSnapshot(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const htmlLanguage = document.documentElement.lang?.split("-")[0];
  const storedLanguage = window.localStorage.getItem("erp_lang");
  const candidate = (storedLanguage || htmlLanguage || "en") as SupportedLanguage;
  return supportedLanguages.some((language) => language.code === candidate) ? candidate : "en";
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === "erp_lang") onStoreChange();
  };
  const handleLanguageChange = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(ERP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ERP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  };
}

export function useErpLanguage(): SupportedLanguage {
  return useSyncExternalStore(subscribe, getLanguageSnapshot, () => "en");
}
