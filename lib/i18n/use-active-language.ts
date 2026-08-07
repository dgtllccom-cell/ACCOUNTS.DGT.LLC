"use client";

import { useEffect, useState } from "react";
import type { SupportedLanguage } from "./languages";

export function useActiveLanguage(): SupportedLanguage {
  const [lang, setLang] = useState<SupportedLanguage>(() => {
    if (typeof document !== "undefined") {
      const stored = localStorage.getItem("erp_lang");
      if (stored === "ur" || stored === "ar" || stored === "fa" || stored === "ps" || stored === "en") {
        return stored as SupportedLanguage;
      }
      const htmlLang = document.documentElement.lang;
      if (htmlLang === "ur" || htmlLang === "ar" || htmlLang === "fa" || htmlLang === "ps" || htmlLang === "en") {
        return htmlLang as SupportedLanguage;
      }
    }
    return "en";
  });

  useEffect(() => {
    function handleUpdate() {
      const next = (localStorage.getItem("erp_lang") || document.documentElement.lang || "en") as SupportedLanguage;
      if (["en", "ur", "ar", "fa", "ps"].includes(next)) {
        setLang((prev) => (prev !== next ? (next as SupportedLanguage) : prev));
      }
    }

    window.addEventListener("storage", handleUpdate);
    window.addEventListener("erp_language_changed", handleUpdate);
    
    let observer: MutationObserver | null = null;
    if (typeof document !== "undefined" && document.documentElement) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.attributeName === "lang") {
            handleUpdate();
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }

    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("erp_language_changed", handleUpdate);
      observer?.disconnect();
    };
  }, []);

  return lang;
}
