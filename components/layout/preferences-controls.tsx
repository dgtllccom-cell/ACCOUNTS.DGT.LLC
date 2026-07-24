"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, Moon, Sun, LogOut, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supportedLanguages, type SupportedLanguage, rtlLanguages, getHtmlLanguage } from "@/lib/i18n/languages";
import { getLanguageKeyboardMap } from "@/lib/i18n/keyboard-layouts";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

function getInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const htmlLang = document.documentElement.lang || "en";
  const lang = htmlLang.split("-")[0] as SupportedLanguage;
  return supportedLanguages.some((l) => l.code === lang) ? lang : "en";
}

// Dynamically inject custom web fonts into document head.
function injectWebFonts(lang: SupportedLanguage) {
  if (typeof document === "undefined") return;
  const id = "google-fonts-rtl-injector";
  let link = document.getElementById(id) as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  if (lang === "ar" || lang === "ps") {
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Cairo', sans-serif");
  } else if (lang === "fa") {
    link.href = "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Vazirmatn', sans-serif");
  } else if (lang === "ur") {
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif");
  } else {
    document.documentElement.style.removeProperty("--font-family-override");
  }
}

export function PreferencesControls() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [keyboardMapperActive, setKeyboardMapperActive] = useState(true);

  const languageOptions = useMemo(() => supportedLanguages, []);

  // Run font injection on load and whenever language state updates.
  useEffect(() => {
    if (mounted) {
      injectWebFonts(language);
    }
  }, [language, mounted]);

  // Handle global key events for virtual layout mapping.
  useEffect(() => {
    if (!keyboardMapperActive || !rtlLanguages.includes(language)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (!isInput) return;

      // Skip common modifiers/control keys.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const langMap = getLanguageKeyboardMap(language);
      if (!langMap) return;

      const mappedChar = langMap[e.key];
      if (mappedChar === undefined) return;

      // Block normal input typing and insert mapped Unicode character at cursor.
      e.preventDefault();

      const input = target as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const val = input.value;
      const newVal = val.substring(0, start) + mappedChar + val.substring(end);

      const prototype = input.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

      if (nativeSetter) {
        nativeSetter.call(input, newVal);
      } else {
        input.value = newVal;
      }

      const nextCursor = start + mappedChar.length;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.setSelectionRange(nextCursor, nextCursor);
      requestAnimationFrame(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(nextCursor, nextCursor);
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [language, keyboardMapperActive]);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
    const initialLang = getInitialLanguage();
    setLanguage(initialLang);
    injectWebFonts(initialLang);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "erp_theme" && (event.newValue === "light" || event.newValue === "dark")) {
        document.documentElement.classList.toggle("dark", event.newValue === "dark");
        setTheme(event.newValue);
      }
      if (event.key === "erp_lang" && event.newValue) {
        const next = event.newValue as SupportedLanguage;
        if (languageOptions.some((l) => l.code === next)) {
          document.documentElement.lang = getHtmlLanguage(next);
          document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
          setLanguage(next);
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [languageOptions]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("erp_theme", next);
    setTheme(next);
  }

  function changeLanguage(next: SupportedLanguage) {
    document.documentElement.lang = getHtmlLanguage(next);
    document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
    localStorage.setItem("erp_lang", next);
    document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Clear legacy Google Translate cookies if present
    document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";

    setLanguage(next);
    injectWebFonts(next);
    router.refresh();
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/erp/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  }

  const isRtlLangActive = rtlLanguages.includes(language);

  return (
    <div className="flex items-center gap-2">
      {/* Dynamic font styles applied based on override CSS variable */}
      {mounted && (
        <style dangerouslySetInnerHTML={{
          __html: `
            body, input, select, textarea, button, select option {
              font-family: var(--font-family-override, inherit) !important;
            }
          `
        }} />
      )}

      {/* Keyboard mapper toggle (Only visible when RTL language is active) */}
      {mounted && isRtlLangActive && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setKeyboardMapperActive(!keyboardMapperActive)}
          className={cn(
            "h-8 w-8 relative rounded-lg border",
            keyboardMapperActive
              ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:border-indigo-900/40"
              : "text-slate-400 hover:bg-slate-50"
          )}
          title={keyboardMapperActive ? "Disable virtual keyboard translation" : "Enable virtual keyboard translation"}
        >
          <Keyboard className="h-4 w-4" />
          {keyboardMapperActive && (
            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
          )}
        </Button>
      )}

      <div className="hidden items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs sm:flex">
        <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <label className="sr-only" htmlFor="erp-language">
          Language
        </label>
        {mounted ? (
          <select
            id="erp-language"
            className="bg-transparent text-xs outline-none"
            value={language}
            onChange={(event) => changeLanguage(event.target.value as SupportedLanguage)}
          >
            {languageOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.englishName} - {lang.nativeName}
              </option>
            ))}
          </select>
        ) : (
          <span className="w-20" />
        )}
      </div>

      <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {mounted ? (
          theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />
        ) : (
          <span className="sr-only">Theme</span>
        )}
      </Button>

      <div className="sm:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label="Language"
          onClick={() => changeLanguage(language === "en" ? "ur" : "en")}
        >
          <Globe2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleLogout}
        disabled={isLoggingOut}
        aria-label="Log out"
        title="Log out"
        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}




