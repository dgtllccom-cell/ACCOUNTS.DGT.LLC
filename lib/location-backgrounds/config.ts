/**
 * Dynamic location background — reusable configuration.
 *
 * One source of truth for the backdrop shown behind location-scoped screens
 * (Global / Country Admin / Main Branch / City Branch / Clearing Agent views).
 *
 * Resolution / fallback order (so the area is NEVER blank):
 *   branch/city image  →  state/province image  →  country image  →  global default
 *
 * Every entry ships a guaranteed CSS/SVG theme; `imageUrl` is an OPTIONAL
 * enhancement layered on top. If the image fails to load the theme still shows.
 * This is data + config, not hardcoded screens — add a row, get a backdrop.
 */

export type LocationTheme = {
  /** distinct id used for the SVG generator + caching */
  key: string;
  /** human label shown in the overlay, e.g. "Pakistan", "Sindh · Karachi" */
  label: string;
  /** 2-3 stop gradient (top → bottom) */
  gradient: [string, string, string];
  /** accent used for the abstract landmark silhouette */
  accent: string;
  /** which silhouette the SVG generator draws */
  landmark: "globe" | "mosque" | "skyscraper" | "mountains" | "fort" | "port" | "minaret" | "city" | "generic";
  /** optional real photo URL (Wikimedia Commons / same-origin). Layered over the theme. */
  imageUrl?: string;
};

const GLOBAL: LocationTheme = {
  key: "global",
  label: "Global · All Countries",
  gradient: ["#0b1e3f", "#0a2f5c", "#06121f"],
  accent: "#38bdf8",
  landmark: "globe",
};

// ── Country themes, keyed by ISO-2 (upper) ──
export const COUNTRY_THEMES: Record<string, LocationTheme> = {
  PK: {
    key: "PK",
    label: "Pakistan",
    gradient: ["#053b2b", "#065f46", "#022c22"],
    accent: "#34d399",
    landmark: "mosque", // Faisal Mosque, Islamabad
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Faisal_Mosque_2020.jpg/1280px-Faisal_Mosque_2020.jpg",
  },
  AE: {
    key: "AE",
    label: "United Arab Emirates",
    gradient: ["#0b1a3a", "#12306b", "#0a1220"],
    accent: "#fbbf24",
    landmark: "skyscraper", // Burj Khalifa / Dubai skyline
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/800px-Burj_Khalifa.jpg",
  },
  AF: {
    key: "AF",
    label: "Afghanistan",
    gradient: ["#3a1e05", "#7c3a10", "#1f1206"],
    accent: "#f59e0b",
    landmark: "mountains", // Hindu Kush / Band-e Amir
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Band-e_Amir_lakes.jpg/1280px-Band-e_Amir_lakes.jpg",
  },
  IN: {
    key: "IN",
    label: "India",
    gradient: ["#3a0b2e", "#7c1d5a", "#1f0619"],
    accent: "#f472b6",
    landmark: "fort",
  },
  IR: {
    key: "IR",
    label: "Iran",
    gradient: ["#0b2f3a", "#0e5566", "#061c22"],
    accent: "#2dd4bf",
    landmark: "minaret",
  },
  SA: {
    key: "SA",
    label: "Saudi Arabia",
    gradient: ["#062b1f", "#0b5137", "#03150f"],
    accent: "#4ade80",
    landmark: "mosque",
  },
  CN: {
    key: "CN",
    label: "China",
    gradient: ["#3a0b0b", "#7c1d1d", "#1f0606"],
    accent: "#f87171",
    landmark: "city",
  },
};

// ── State / province overrides (optional). Keyed by "ISO2:state-slug". ──
export const STATE_THEMES: Record<string, Partial<LocationTheme>> = {
  "PK:balochistan": { label: "Balochistan", landmark: "fort", accent: "#fcd34d" }, // Quetta — Hanna Lake / Quaid-e-Azam Residency
  "PK:sindh": { label: "Sindh", landmark: "port", accent: "#38bdf8" }, // Karachi port
  "PK:punjab": { label: "Punjab", landmark: "fort", accent: "#fb923c" }, // Lahore Fort / Badshahi
  "PK:khyber-pakhtunkhwa": { label: "Khyber Pakhtunkhwa", landmark: "mountains", accent: "#4ade80" },
  "PK:islamabad": { label: "Islamabad Capital Territory", landmark: "mosque", accent: "#34d399" },
  "AE:dubai": { label: "Dubai", landmark: "skyscraper", accent: "#fbbf24" },
  "AE:abu-dhabi": { label: "Abu Dhabi", landmark: "mosque", accent: "#a7f3d0" }, // Sheikh Zayed Grand Mosque
};

// ── City overrides (optional). Keyed by "ISO2:city-slug". ──
export const CITY_THEMES: Record<string, Partial<LocationTheme>> = {
  "PK:quetta": { label: "Quetta", landmark: "mountains", accent: "#fcd34d" },
  "PK:chaman": { label: "Chaman", landmark: "port", accent: "#f59e0b" }, // border trade town
  "PK:karachi": { label: "Karachi", landmark: "port", accent: "#38bdf8" },
  "PK:lahore": { label: "Lahore", landmark: "fort", accent: "#fb923c" },
  "PK:islamabad": { label: "Islamabad", landmark: "mosque", accent: "#34d399" },
  "AE:dubai": { label: "Dubai", landmark: "skyscraper", accent: "#fbbf24" },
  "AF:kabul": { label: "Kabul", landmark: "mountains", accent: "#f59e0b" },
  "AF:kandahar": { label: "Kandahar", landmark: "fort", accent: "#fcd34d" },
};

export function slug(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export type LocationSelection = {
  iso2?: string | null;
  countryName?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  branchName?: string | null;
};

/**
 * Resolve the effective theme for a selection using the fallback chain.
 * Always returns a theme (never null) — Global default at the end.
 */
export function resolveLocationTheme(sel: LocationSelection): LocationTheme {
  const iso = (sel.iso2 || "").toUpperCase();
  const country = iso ? COUNTRY_THEMES[iso] : undefined;
  const base: LocationTheme = country ? { ...country } : { ...GLOBAL };
  if (!iso) return { ...GLOBAL, label: sel.countryName?.trim() || GLOBAL.label };

  // country label refinement
  if (sel.countryName?.trim()) base.label = sel.countryName.trim();

  // state override
  const stateKey = sel.stateName ? `${iso}:${slug(sel.stateName)}` : "";
  const stateOv = stateKey ? STATE_THEMES[stateKey] : undefined;
  let theme: LocationTheme = stateOv ? { ...base, ...stateOv, key: `${base.key}-${slug(sel.stateName!)}`, label: `${base.label} · ${stateOv.label ?? sel.stateName}` } : base;

  // city override (wins over state)
  const cityKey = sel.cityName ? `${iso}:${slug(sel.cityName)}` : "";
  const cityOv = cityKey ? CITY_THEMES[cityKey] : undefined;
  if (cityOv) {
    theme = { ...theme, ...cityOv, key: `${base.key}-${slug(sel.cityName!)}`, label: `${base.label} · ${cityOv.label ?? sel.cityName}` };
  } else if (sel.cityName?.trim()) {
    theme = { ...theme, key: `${theme.key}-${slug(sel.cityName)}`, label: `${theme.label} · ${sel.cityName.trim()}` };
  }

  // branch label refinement (uses city/state image; just extends the label)
  if (sel.branchName?.trim() && !theme.label.includes(sel.branchName.trim())) {
    theme = { ...theme, label: `${theme.label} · ${sel.branchName.trim()}` };
  }

  return theme;
}

export const GLOBAL_THEME = GLOBAL;
