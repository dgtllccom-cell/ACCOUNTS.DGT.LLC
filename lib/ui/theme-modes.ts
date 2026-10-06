export const themeModes = [
  { id: "night", accentClass: "theme-night", legacyClass: "dark", labelKey: "nav.theme_night" },
  { id: "day", accentClass: "theme-day", legacyClass: "", labelKey: "nav.theme_day" },
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

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-night", "theme-day", "theme-soft", "theme-green-business");
  root.classList.add(`theme-${mode === "green" ? "green-business" : mode}`);
  root.classList.toggle("dark", mode === "night");
  root.dataset.erpThemeMode = mode;
  root.style.colorScheme = mode === "night" ? "dark" : "light";
}

export function getThemeModeClass(mode: ThemeMode) {
  return mode === "green" ? "theme-green-business" : `theme-${mode}`;
}
