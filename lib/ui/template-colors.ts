export const templateColors = [
  { id: "purple", hex: "#5B21B6" },
  { id: "blue", hex: "#1D4ED8" },
  { id: "green", hex: "#15803D" },
  { id: "gold", hex: "#D97706" },
  { id: "cyan", hex: "#0891B2" },
  { id: "red", hex: "#DC4B4B" },
  { id: "teal", hex: "#0F766E" },
  { id: "pink", hex: "#DB2777" },
  { id: "navy", hex: "#1E3A8A" },
  { id: "slate", hex: "#475569" },
  { id: "mint", hex: "#6BAF9A" },
  { id: "peach", hex: "#E9A68C" },
  { id: "lavender", hex: "#A995D5" },
] as const;

export type TemplateColor = (typeof templateColors)[number]["id"];

export function normalizeTemplateColor(value: string | null | undefined): TemplateColor {
  const allowed = new Set(templateColors.map((c) => c.id));
  if (value && allowed.has(value as TemplateColor)) return value as TemplateColor;
  return "purple";
}

export function getTemplateColorClass(color: TemplateColor) {
  return `theme-${color}` as const;
}

export function applyTemplateColor(color: TemplateColor) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(...templateColors.map((c) => getTemplateColorClass(c.id)));
  document.documentElement.classList.add(getTemplateColorClass(color));
}

