"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, HelpCircle, Moon, Sun } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { supportedLanguages, rtlLanguages } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function AuthTopControls({ lang }: { lang: SupportedLanguage }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const languageOptions = useMemo(() => supportedLanguages, []);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("erp_theme", next);
    setTheme(next);
  }

  function changeLanguage(next: SupportedLanguage) {
    document.documentElement.lang = next;
    document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
    localStorage.setItem("erp_lang", next);
    document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Clear legacy Google Translate cookies if present
    document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    
    window.location.reload();
  }

  return (
    <div className="flex items-center justify-end gap-3 text-white/90">
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="hidden items-center gap-2 text-sm font-medium hover:text-white md:inline-flex"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        {t(lang, "auth.support")}
      </a>

      <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs md:flex">
        <Globe2 className="h-4 w-4" aria-hidden />
        <select
          className={cn("bg-transparent text-xs font-semibold outline-none", mounted ? "" : "opacity-0")}
          value={lang}
          onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
          aria-label="Language"
        >
          {languageOptions.map((l) => (
            <option key={l.code} value={l.code}>
              {l.englishName}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {mounted ? (
          theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />
        ) : (
          <span className="sr-only">Theme</span>
        )}
      </Button>
    </div>
  );
}

