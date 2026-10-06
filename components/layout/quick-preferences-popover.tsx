"use client";

import { useMemo } from "react";
import { Keyboard, LogOut, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { t as uiText } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { themeModes, type ThemeMode } from "@/lib/ui/theme-modes";

type QuickPreferencesPopoverProps = {
  language: SupportedLanguage;
  themeMode: ThemeMode;
  keyboardMapperActive?: boolean;
  showKeyboardMapper?: boolean;
  showLogout?: boolean;
  isLoggingOut?: boolean;
  onLanguageChange: (next: SupportedLanguage) => void;
  onThemeChange: (next: ThemeMode) => void;
  onToggleKeyboardMapper?: () => void;
  onLogout?: () => void | Promise<void>;
  triggerClassName?: string;
  triggerLabel?: string;
};

function buildLanguageOptions(): SearchSelectOption[] {
  return supportedLanguages.map((language) => ({
    value: language.code,
    label: language.nativeName,
    keywords: [language.code, language.englishName, language.nativeName].join(" ")
  }));
}

export function QuickPreferencesPopover({
  language,
  themeMode,
  keyboardMapperActive = true,
  showKeyboardMapper = false,
  showLogout = false,
  isLoggingOut = false,
  onLanguageChange,
  onThemeChange,
  onToggleKeyboardMapper,
  onLogout,
  triggerClassName,
  triggerLabel
}: QuickPreferencesPopoverProps) {
  const languageOptions = useMemo(() => buildLanguageOptions(), []);
  const themeOptions = useMemo<SearchSelectOption[]>(
    () =>
      themeModes.map((mode) => ({
        value: mode.id,
        label: uiText(language, mode.labelKey),
        keywords: [mode.id, uiText(language, mode.labelKey), uiText(language, "nav.theme_mode")].join(" ")
      })),
    [language]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 rounded-full border-border bg-background px-3 text-xs font-semibold shadow-sm hover:bg-muted",
            triggerClassName
          )}
          aria-label={triggerLabel ?? uiText(language, "common.settings")}
          title={triggerLabel ?? uiText(language, "common.settings")}
        >
          <Settings2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{triggerLabel ?? uiText(language, "common.settings")}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(92vw,440px)] rounded-2xl border border-border/80 bg-popover p-4 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {uiText(language, "common.settings")}
            </p>
            <p className="text-xs text-muted-foreground">
              {uiText(language, "nav.language")} · {uiText(language, "nav.theme_mode")}
              {showKeyboardMapper ? ` · ${uiText(language, "nav.keyboard_mapper")}` : ""}
            </p>
          </div>

          <SearchSelect
            label={uiText(language, "nav.language")}
            value={language}
            options={languageOptions}
            onValueChange={(next) => onLanguageChange(next as SupportedLanguage)}
            placeholder={uiText(language, "common.select")}
            searchPlaceholder={uiText(language, "common.search")}
            emptyLabel={uiText(language, "common.no_matches_found")}
            triggerClassName="rounded-xl"
            className="w-full"
          />

          <SearchSelect
            label={uiText(language, "nav.theme_mode")}
            value={themeMode}
            options={themeOptions}
            onValueChange={(next) => onThemeChange(next as ThemeMode)}
            placeholder={uiText(language, "common.select")}
            searchPlaceholder={uiText(language, "common.search")}
            emptyLabel={uiText(language, "common.no_matches_found")}
            triggerClassName="rounded-xl"
            className="w-full"
          />

          {showKeyboardMapper && (
            <Button
              type="button"
              variant="outline"
              onClick={onToggleKeyboardMapper}
              className={cn(
                "h-11 w-full justify-between rounded-xl border-dashed px-3 text-xs font-semibold",
                keyboardMapperActive
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Keyboard className="h-4 w-4" aria-hidden />
                <span>{uiText(language, "nav.keyboard_mapper")}</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {keyboardMapperActive ? uiText(language, "common.active") : uiText(language, "common.inactive")}
              </span>
            </Button>
          )}

          {showLogout && onLogout && (
            <Button
              type="button"
              variant="outline"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="h-11 w-full justify-between rounded-xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100/80 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" aria-hidden />
                <span>{uiText(language, "auth.logout")}</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {isLoggingOut ? uiText(language, "common.loading") : ""}
              </span>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
