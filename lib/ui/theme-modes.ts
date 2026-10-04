export const themeModes = [
  { id: "day", accentClass: "theme-day", legacyClass: "", labelKey: "nav.theme_day" },
  { id: "night", accentClass: "theme-night", legacyClass: "dark", labelKey: "nav.theme_night" },
  // follows the device: white in daytime (light OS setting), dark at night (dark OS setting) — switches live
  { id: "system", accentClass: "theme-system", legacyClass: "", labelKey: "nav.theme_system" },
  { id: "soft", accentClass: "theme-soft", legacyClass: "", labelKey: "nav.theme_soft" },
  { id: "green", accentClass: "theme-green-business", legacyClass: "", labelKey: "nav.theme_green_business" }
] as const;

export type ThemeMode = (typeof themeModes)[number]["id"];

const allowedThemeModes = new Set(themeModes.map((mode) => mode.id));

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  if (value && allowedThemeModes.has(value as ThemeMode)) return value as ThemeMode;
  return "day";
}

export function legacyThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "dark") return "night";
  if (value === "light") return "day";
  return normalizeThemeMode(value);
}

/** True when the mode renders dark right now ("system" asks the device). */
export function themeModeIsDark(mode: ThemeMode): boolean {
  if (mode === "night") return true;
  if (mode === "system") return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return false;
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null;

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-night", "theme-day", "theme-soft", "theme-green-business", "theme-system");
  root.classList.add(getThemeModeClass(mode));
  const dark = themeModeIsDark(mode);
  root.classList.toggle("dark", dark);
  root.dataset.erpThemeMode = mode;
  root.style.colorScheme = dark ? "dark" : "light";
  // "system" keeps following the device when it switches between day and night
  const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;
  if (mq && systemListener) { mq.removeEventListener?.("change", systemListener); systemListener = null; }
  if (mq && mode === "system") {
    systemListener = (e) => { root.classList.toggle("dark", e.matches); root.style.colorScheme = e.matches ? "dark" : "light"; };
    mq.addEventListener?.("change", systemListener);
  }
}

export function getThemeModeClass(mode: ThemeMode) {
  return mode === "green" ? "theme-green-business" : `theme-${mode}`;
}
