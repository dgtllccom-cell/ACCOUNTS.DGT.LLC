/**
 * Pure-SVG backdrop generator for a LocationTheme — CSP-safe, offline, never
 * blank. Draws a gradient sky + an abstract landmark silhouette. Returned as a
 * data: URI so it can be used directly as a CSS background-image.
 */
import type { LocationTheme } from "./config";

function landmarkPath(kind: LocationTheme["landmark"], accent: string): string {
  // all shapes drawn in a 1200×360 viewbox, sitting on the horizon (y≈300)
  switch (kind) {
    case "globe":
      return `
        <circle cx="600" cy="180" r="150" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
        <ellipse cx="600" cy="180" rx="150" ry="55" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>
        <ellipse cx="600" cy="180" rx="90" ry="150" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>
        <line x1="450" y1="180" x2="750" y2="180" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>`;
    case "mosque":
      return `
        <rect x="470" y="230" width="260" height="70" fill="${accent}" opacity="0.9"/>
        <path d="M540 230 a60 60 0 0 1 120 0 z" fill="${accent}" opacity="0.9"/>
        <rect x="452" y="150" width="14" height="150" fill="${accent}" opacity="0.85"/>
        <rect x="734" y="150" width="14" height="150" fill="${accent}" opacity="0.85"/>
        <circle cx="459" cy="144" r="10" fill="${accent}"/><circle cx="741" cy="144" r="10" fill="${accent}"/>`;
    case "minaret":
      return `
        <rect x="560" y="120" width="26" height="180" fill="${accent}" opacity="0.85"/>
        <rect x="614" y="150" width="20" height="150" fill="${accent}" opacity="0.7"/>
        <path d="M560 120 h26 l-13 -26 z" fill="${accent}"/>
        <rect x="500" y="240" width="240" height="60" fill="${accent}" opacity="0.8"/>`;
    case "skyscraper":
      return `
        <path d="M585 40 L600 20 L615 40 L615 300 L585 300 Z" fill="${accent}" opacity="0.9"/>
        <rect x="540" y="120" width="34" height="180" fill="${accent}" opacity="0.6"/>
        <rect x="626" y="150" width="34" height="150" fill="${accent}" opacity="0.6"/>
        <rect x="500" y="200" width="28" height="100" fill="${accent}" opacity="0.4"/>
        <rect x="672" y="210" width="28" height="90" fill="${accent}" opacity="0.4"/>`;
    case "mountains":
      return `
        <path d="M300 300 L520 120 L640 220 L780 80 L980 300 Z" fill="${accent}" opacity="0.8"/>
        <path d="M520 120 L560 160 L500 165 Z" fill="#ffffff" opacity="0.75"/>
        <path d="M780 80 L820 130 L740 135 Z" fill="#ffffff" opacity="0.75"/>`;
    case "fort":
      return `
        <rect x="470" y="170" width="260" height="130" fill="${accent}" opacity="0.85"/>
        <g fill="${accent}">
          <rect x="470" y="150" width="24" height="24"/><rect x="518" y="150" width="24" height="24"/>
          <rect x="566" y="150" width="24" height="24"/><rect x="614" y="150" width="24" height="24"/>
          <rect x="662" y="150" width="24" height="24"/><rect x="706" y="150" width="24" height="24"/>
        </g>
        <rect x="576" y="235" width="48" height="65" fill="#0b1220" opacity="0.6"/>`;
    case "port":
      return `
        <rect x="440" y="250" width="320" height="50" fill="${accent}" opacity="0.6"/>
        <path d="M470 250 v-90 M470 160 h120 M580 160 l-30 60" stroke="${accent}" stroke-width="8" fill="none"/>
        <path d="M700 250 v-70 M700 180 h90 M790 180 l-24 50" stroke="${accent}" stroke-width="8" fill="none"/>
        <rect x="500" y="215" width="70" height="35" fill="${accent}" opacity="0.8"/>
        <rect x="580" y="220" width="70" height="30" fill="${accent}" opacity="0.6"/>`;
    case "city":
      return `
        <g fill="${accent}">
          <rect x="470" y="180" width="36" height="120" opacity="0.85"/>
          <rect x="516" y="150" width="36" height="150" opacity="0.7"/>
          <rect x="562" y="200" width="36" height="100" opacity="0.6"/>
          <rect x="608" y="130" width="36" height="170" opacity="0.85"/>
          <rect x="654" y="190" width="36" height="110" opacity="0.6"/>
          <rect x="700" y="165" width="36" height="135" opacity="0.75"/>
        </g>`;
    default:
      return `<rect x="500" y="200" width="200" height="100" fill="${accent}" opacity="0.6"/>`;
  }
}

export function backdropDataUri(theme: LocationTheme): string {
  const [g0, g1, g2] = theme.gradient;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${g0}"/><stop offset="0.55" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.28" r="0.6">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.28"/><stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="360" fill="url(#sky)"/>
  <rect width="1200" height="360" fill="url(#glow)"/>
  <g opacity="0.16">${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 137) % 1200}" cy="${(i * 53) % 240}" r="1.4" fill="#ffffff"/>`).join("")}</g>
  <rect x="0" y="300" width="1200" height="60" fill="#000000" opacity="0.25"/>
  ${landmarkPath(theme.landmark, theme.accent)}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
