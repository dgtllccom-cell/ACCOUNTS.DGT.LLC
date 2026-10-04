export const themeModes = [
  // "studio" = the owner's AI Studio mobile/tablet design (dark slate surfaces, 44px touch controls, rounded section cards).
  // Presentation only: every rule lives in app/studio-theme.css and is scoped to :root[data-erp-theme-mode="studio"].
  { id: "studio", accentClass: "theme-studio", legacyClass: "dark", labelKey: "nav.theme_studio" },
  { id: "night", accentClass: "theme-night", legacyClass: "dark", labelKey: "nav.theme_night" },
  { id: "day", accentClass: "theme-day", legacyClass: "", labelKey: "nav.theme_day" },
  { id: "soft", accentClass: "theme-soft", legacyClass: "", labelKey: "nav.theme_soft" },
  { id: "green", accentClass: "theme-green-business", legacyClass: "", labelKey: "nav.theme_green_business" }
] as const;

export type ThemeMode = (typeof themeModes)[number]["id"];

const allowedThemeModes = new Set(themeModes.map((mode) => mode.id));

/** Theme used when the viewer has not chosen one yet. */
export const DEFAULT_THEME_MODE: ThemeMode = "studio";

/** Modes that render on dark surfaces (they also set the legacy `dark` class). */
export const DARK_THEME_MODES: readonly ThemeMode[] = ["night", "studio"];

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  if (value && allowedThemeModes.has(value as ThemeMode)) return value as ThemeMode;
  return DEFAULT_THEME_MODE;
}

export function legacyThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "dark") return "night";
  if (value === "light") return "day";
  return normalizeThemeMode(value);
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-night", "theme-day", "theme-soft", "theme-green-business", "theme-studio");
  root.classList.add(`theme-${mode === "green" ? "green-business" : mode}`);
  const dark = DARK_THEME_MODES.includes(mode);
  root.classList.toggle("dark", dark);
  root.dataset.erpThemeMode = mode;
  root.style.colorScheme = dark ? "dark" : "light";
}

export function getThemeModeClass(mode: ThemeMode) {
  return mode === "green" ? "theme-green-business" : `theme-${mode}`;
}
