"use client";

/**
 * Dependency-free, CSP-safe Code 128 (subset B) barcode renderer — pure inline SVG,
 * no canvas, no external library, no data: URIs. Used for the product master barcode
 * on screen and in Print/PDF label output.
 *
 * Subset B covers ASCII 32–126 (digits + upper/lower letters + common symbols) which
 * is the full range the product-master `barcode` field allows. Characters outside that
 * range are dropped. An empty / whitespace value renders nothing.
 */

const PATTERNS: string[] = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

const START_B = 104;
const STOP = 106;

function encode(value: string): string[] | null {
  const clean = Array.from(value).filter((ch) => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c <= 126;
  });
  if (clean.length === 0) return null;

  const codes: number[] = [START_B];
  for (const ch of clean) codes.push(ch.charCodeAt(0) - 32);

  let checksum = START_B;
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(STOP);

  return codes.map((v) => PATTERNS[v]);
}

export type BarcodeProps = {
  value: string;
  /** width of one module in px (default 1.6) */
  moduleWidth?: number;
  height?: number;
  /** show the human-readable value under the bars */
  showText?: boolean;
  className?: string;
  /** background — keep white for scanners; set "transparent" only for on-screen chips */
  background?: string;
};

export function Barcode({
  value,
  moduleWidth: moduleWidthProp = 1.6,
  height: heightProp = 56,
  showText = true,
  className,
  background = "#ffffff"
}: BarcodeProps) {
  // Never let a NaN/Infinite prop reach an SVG numeric attribute (React warns + broken render).
  const moduleWidth = Number.isFinite(moduleWidthProp) && moduleWidthProp > 0 ? moduleWidthProp : 1.6;
  const height = Number.isFinite(heightProp) && heightProp > 0 ? heightProp : 56;
  const patterns = encode((value ?? "").trim());
  if (!patterns) return null;

  const quiet = 10; // modules of quiet zone each side
  let x = quiet;
  const bars: Array<{ x: number; w: number }> = [];
  for (const pat of patterns) {
    let isBar = true;
    for (const chStr of pat) {
      const w = Number(chStr);
      if (isBar) bars.push({ x, w });
      x += w;
      isBar = !isBar;
    }
  }
  const totalModules = x + quiet;
  const svgWidth = totalModules * moduleWidth;
  const textH = showText ? 14 : 0;
  const barH = height - textH;

  return (
    <svg
      className={className}
      width={svgWidth}
      height={height}
      viewBox={`0 0 ${svgWidth} ${height}`}
      role="img"
      aria-label={`Barcode ${value}`}
      style={{ maxWidth: "100%" }}
    >
      <rect x={0} y={0} width={svgWidth} height={height} fill={background} />
      {bars.map((b, i) => (
        <rect key={i} x={b.x * moduleWidth} y={0} width={b.w * moduleWidth} height={barH} fill="#000000" />
      ))}
      {showText && (
        <text
          x={svgWidth / 2}
          y={height - 2}
          textAnchor="middle"
          fontFamily="'Courier New', monospace"
          fontSize={12}
          fill="#000000"
        >
          {value}
        </text>
      )}
    </svg>
  );
}

/**
 * Server-safe variant: returns the `<svg>…</svg>` markup as a string for embedding in
 * Print/PDF HTML templates (no React runtime). Same encoder.
 */
export function barcodeSvgMarkup(value: string, opts?: { moduleWidth?: number; height?: number; showText?: boolean }): string {
  const moduleWidth = opts?.moduleWidth ?? 1.6;
  const height = opts?.height ?? 56;
  const showText = opts?.showText ?? true;
  const patterns = encode((value ?? "").trim());
  if (!patterns) return "";

  const quiet = 10;
  let x = quiet;
  const bars: Array<{ x: number; w: number }> = [];
  for (const pat of patterns) {
    let isBar = true;
    for (const chStr of pat) {
      const w = Number(chStr);
      if (isBar) bars.push({ x, w });
      x += w;
      isBar = !isBar;
    }
  }
  const totalModules = x + quiet;
  const svgWidth = totalModules * moduleWidth;
  const textH = showText ? 14 : 0;
  const barH = height - textH;
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

  const rects = bars
    .map((b) => `<rect x="${(b.x * moduleWidth).toFixed(2)}" y="0" width="${(b.w * moduleWidth).toFixed(2)}" height="${barH}" fill="#000"/>`)
    .join("");
  const text = showText
    ? `<text x="${(svgWidth / 2).toFixed(2)}" y="${height - 2}" text-anchor="middle" font-family="'Courier New',monospace" font-size="12" fill="#000">${esc(value)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth.toFixed(2)}" height="${height}" viewBox="0 0 ${svgWidth.toFixed(2)} ${height}" role="img" aria-label="Barcode ${esc(value)}"><rect x="0" y="0" width="${svgWidth.toFixed(2)}" height="${height}" fill="#fff"/>${rects}${text}</svg>`;
}
