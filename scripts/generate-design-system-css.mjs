import fs from "node:fs";
// Phones: < 640px. Tablets: < 1024px, or any touch screen (coarse pointer) up to 1399px (iPad / Android tablets in
// landscape). Desktop computers (mouse, >= 1024px) get NO rule from this file — their design stays exactly as before.
const TOUCH = "screen and (max-width: 1023.98px), screen and (pointer: coarse) and (max-width: 1399.98px)";
const NAVBAR = "screen and (max-width: 1023.98px)"; // the mobile bottom navigation is shown below lg (1024px)
const PHONE = "screen and (max-width: 639.98px)";
const C = "[data-erp-content]";
const D = ":root.dark";
const WD = ":where(:root.dark)";
const FIELD = `input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])`;
const BTN = `button:not(.rounded-full):not([role="switch"]):not([role="checkbox"])`;

const hues = {
  blue: ["59 130 246", "96 165 250"], sky: ["14 165 233", "56 189 248"], indigo: ["99 102 241", "129 140 248"],
  violet: ["139 92 246", "167 139 250"], purple: ["168 85 247", "192 132 252"], fuchsia: ["217 70 239", "232 121 249"],
  pink: ["236 72 153", "244 114 182"], rose: ["244 63 94", "251 113 133"], red: ["239 68 68", "248 113 113"],
  orange: ["249 115 22", "251 146 60"], amber: ["245 158 11", "251 191 36"], yellow: ["234 179 8", "250 204 21"],
  lime: ["132 204 22", "163 230 53"], green: ["34 197 94", "74 222 128"], emerald: ["16 185 129", "52 211 153"],
  teal: ["20 184 166", "45 212 191"], cyan: ["6 182 212", "34 211 238"],
};
const alphas = ["", "\\/50", "\\/60", "\\/70", "\\/80"];
let tint = "";
for (const [h, [c500, c400]] of Object.entries(hues)) {
  tint += `    ${alphas.map((a) => `${WD} .bg-${h}-50${a}`).join(", ")} { background-color: rgb(${c500} / 0.10); }\n`;
  tint += `    ${alphas.map((a) => `${WD} .bg-${h}-100${a}`).join(", ")} { background-color: rgb(${c500} / 0.16); }\n`;
  tint += `    ${WD} .text-${h}-600, ${WD} .text-${h}-700, ${WD} .text-${h}-800, ${WD} .text-${h}-900 { color: rgb(${c400}); }\n`;
  tint += `    ${WD} .border-${h}-100, ${WD} .border-${h}-200, ${WD} .border-${h}-300 { border-color: rgb(${c500} / 0.35); }\n`;
}
const esc = (c) => c.replace(/[\[\]#]/g, (m) => "\\" + m);
const HEX = {
  text: { "#0f172a": "hsl(var(--foreground))", "#0F172A": "hsl(var(--foreground))", "#0a192f": "hsl(var(--foreground))", "#0f2942": "hsl(var(--foreground))", "#0d2d6b": "rgb(147 197 253)",
          "#1e3a8a": "rgb(96 165 250)", "#1e40af": "rgb(96 165 250)", "#1455ff": "rgb(96 165 250)", "#2563eb": "rgb(96 165 250)", "#1d4ed8": "rgb(96 165 250)",
          "#7c3aed": "rgb(167 139 250)", "#0284c7": "rgb(56 189 248)", "#d97706": "rgb(251 191 36)", "#15803d": "rgb(74 222 128)", "#0f766e": "rgb(45 212 191)", "#059669": "rgb(52 211 153)" },
  bg: { "#f8fafc": "hsl(var(--background))", "#ffffff": "hsl(var(--card))", "#fff": "hsl(var(--card))", "#edf5ff": "rgb(37 99 235 / 0.18)", "#e0f2fe": "rgb(14 165 233 / 0.16)", "#ede9fe": "rgb(139 92 246 / 0.16)",
        "#dcfce7": "rgb(34 197 94 / 0.16)", "#fef3c7": "rgb(245 158 11 / 0.16)", "#ccfbf1": "rgb(20 184 166 / 0.16)" },
};
let hexMap = "";
for (const [kind, map] of Object.entries(HEX)) for (const [hex, val] of Object.entries(map)) {
  const prop = kind === "text" ? "color" : "background-color";
  hexMap += `    ${WD} .${kind}-${esc("[" + hex + "]")}, ${WD} .hover\\:${kind}-${esc("[" + hex + "]")}:hover { ${prop}: ${val}; }\n`;
}

const BASELINE = `
  /* ===== shared design baseline: zero-specificity :where() rules, so any class a screen sets explicitly still wins ===== */
  :root { --ds-radius: 0.75rem; --ds-radius-lg: 1rem; --ds-shadow-xs: 0 1px 2px hsl(var(--foreground) / 0.05); --ds-shadow-sm: 0 1px 3px hsl(var(--foreground) / 0.08), 0 1px 2px hsl(var(--foreground) / 0.05); --ds-focus: 0 0 0 3px hsl(var(--ring) / 0.28); }
  body { font-feature-settings: "kern", "liga", "calt"; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
  :where(${C}) :where(h1, h2, h3) { letter-spacing: -0.01em; text-wrap: balance; }
  /* micro-badges ("SUPER ADMIN ONLY", "PAID", "DRAFT") never break into a narrow vertical stack; their row wraps instead */
  :where(${C}) :is(span, div).uppercase:where(.rounded, .rounded-md, .rounded-full, .rounded-sm):where([class*="text-[9px]"], [class*="text-[10px]"], .text-xs) { white-space: nowrap; flex-shrink: 0; }
  :where(${C}) table { font-variant-numeric: tabular-nums; }
  /* a native dropdown never grows wider than its own cell (appearance-none selects used to spill over the next column) */
  :where(${C}, [role="dialog"]) select { max-width: 100%; min-width: 0; text-overflow: ellipsis; }
  /* ...and the grid / flex cell that holds a dropdown may shrink with its column instead of forcing the next column to overlap */
  :where(${C}, [role="dialog"]) :is(.grid, .flex) > :has(> select) { min-width: 0; }
  :where(${C}) thead th { background-color: hsl(var(--muted) / 0.6); color: hsl(var(--muted-foreground)); font-weight: 700; }
  /* table column headings, everywhere: centred, one moderate size, one line where practical (headings are shortened in the shared
     heading dictionary; the data cells, values and columns are untouched) */
  ${C} table :is(thead th, tfoot th, > tr > th, th[scope="col"]), [role="dialog"] table :is(thead th, > tr > th, th[scope="col"]) {
    text-align: center; font-size: 0.8125rem; line-height: 1.25; font-weight: 700; white-space: nowrap; vertical-align: middle;
    padding-inline: 0.625rem;
  }
  ${C} table thead th > :is(div, span).flex, ${C} table thead th > :is(div, span).inline-flex, [role="dialog"] table thead th > :is(div, span).flex { justify-content: center; text-align: center; }
  /* a hovered table row is tinted without replacing a cell's own colour (status cells keep theirs) */
  ${C} tbody tr:hover > td { background-image: linear-gradient(hsl(var(--primary) / 0.05), hsl(var(--primary) / 0.05)); }
  :where(${C}, [role="dialog"]) :where(${FIELD}, select, textarea) { border-radius: var(--ds-radius); border-color: hsl(var(--input)); transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  ${C} :is(input, select, textarea):focus-visible, [role="dialog"] :is(input, select, textarea):focus-visible { outline: none; border-color: hsl(var(--ring)); box-shadow: var(--ds-focus); }
  ${C} :is(button, [role="button"], a, summary):focus-visible { outline: none; box-shadow: var(--ds-focus); }
  :where(${C}) :is(div, section, article):where(.rounded-xl, .rounded-2xl):where(.border) { box-shadow: var(--ds-shadow-xs); }
  /* Arabic-script languages: letter-spacing breaks the joined letters, so tracking classes are neutralised in RTL */
  :root[dir="rtl"] body, :root[dir="rtl"] body * { letter-spacing: normal !important; }
`;

const css = `/*
 * DGT DESIGN SYSTEM — one shared presentation layer for the whole ERP (phones, tablets, laptops, desktops).
 * PRESENTATION ONLY: colour tokens, sizing, spacing, alignment, responsive layout. No form, field, option, step, formula,
 * validation, permission, record or language is added, removed, hidden or renamed.
 *   - Light = clean white surfaces on a soft canvas; Dark = near-black surfaces; System follows the device.
 *   - Every screen inherits it automatically: colour tokens, a dark bridge for legacy hard-coded light classes, a baseline for
 *     forms / tables / focus (zero specificity), plus the phone / tablet layout layer below.
 *   - Every rule is @media screen (or a plain token): print / PDF output and paper layout are untouched.
 */

/* Light theme (Day, and System in daytime): white surfaces on a soft canvas */
:root[data-erp-theme-mode="day"],
:root[data-erp-theme-mode="system"]:not(.dark) {
  --background: 220 25% 97.5%;
  --foreground: 224 36% 11%;
  --card: 0 0% 100%;
  --card-foreground: 224 36% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 224 36% 11%;
  --secondary: 220 20% 95%;
  --secondary-foreground: 224 36% 14%;
  --muted: 220 18% 94%;
  --muted-foreground: 220 9% 42%;
  --border: 220 15% 88%;
  --input: 220 14% 83%;
}

@media ${TOUCH} {
  /* ================= layout layer: every theme, phones + tablets ================= */
  ${C} { overflow-x: hidden; }
  /* a toolbar group of buttons that was kept at its full width (shrink-0) is pushed off-screen and clipped by the content's
     overflow: let it use the available width and wrap its buttons instead, so every action stays reachable */
  ${C} .flex.shrink-0:has(> button, > a) { max-width: 100%; flex-wrap: wrap; }
  /* any row of action buttons (Print / Next / Back / Save ...) that is wider than the screen wraps onto a second line instead of
     pushing its last buttons off-screen; scrollable strips (overflow-x-auto) and stacked columns are left alone */
  ${C} .flex:not(.flex-col, .flex-col-reverse, .flex-wrap, .overflow-x-auto, .overflow-auto, .overflow-x-scroll):has(> button, > a[class*="btn"]) { flex-wrap: wrap; max-width: 100%; }
  /* the floating chat button sits above everything (z 9998): while a dialog / modal sheet is open it would cover that
     dialog's content and actions, so it steps aside until the dialog closes */
  :root:has(.fixed.inset-0[class*="z-"]:not(.pointer-events-none), [role="dialog"]) [data-dgt-connect] { display: none; }
  ${C} ${FIELD},
  ${C} select { min-height: 2.75rem; font-size: 0.875rem; border-radius: 0.75rem; max-width: 100%; }
  ${C} textarea { font-size: 0.875rem; border-radius: 0.75rem; max-width: 100%; }
  [role="dialog"] ${FIELD}, [role="dialog"] select { min-height: 2.75rem; border-radius: 0.75rem; max-width: 100%; }
  ${C} label { font-size: 0.75rem; font-weight: 700; }
  ${C} .bg-card.rounded-xl, ${C} .bg-card.rounded-2xl, ${C} .premium-card, ${C} .erp-surface { border-radius: 1rem; }
  ${C} .premium-card:hover { transform: none; }
  ${C} ${BTN} { border-radius: 0.75rem; }
  /* primary / submit actions: the template's emerald action button */
  ${C} button[type="submit"]:not(:disabled) {
    background-image: linear-gradient(to right, rgb(5 150 105), rgb(13 148 136), rgb(16 185 129));
    color: #fff;
    border-color: transparent;
    box-shadow: 0 10px 15px -3px rgb(5 150 105 / 0.3);
  }
  /* wide tables scroll inside their own card, never the whole page */
  ${C} :has(> table) { overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; }
  /* edge shadows show there is more table to scroll to (the scroller keeps its own background colour) */
  ${C} :has(> table) {
    background-image: linear-gradient(to right, hsl(var(--card)) 30%, transparent), linear-gradient(to left, hsl(var(--card)) 30%, transparent),
      radial-gradient(farthest-side at 0 50%, rgb(0 0 0 / 0.22), transparent), radial-gradient(farthest-side at 100% 50%, rgb(0 0 0 / 0.22), transparent);
    background-position: left center, right center, left center, right center;
    background-size: 24px 100%, 24px 100%, 10px 100%, 10px 100%;
    background-repeat: no-repeat;
    background-attachment: local, local, scroll, scroll;
  }
  /* a cell holding ONE token (a code, a date, a one-word name) never splits it across lines — marked by components/layout/table-token-guard.tsx */
  ${C} table :is(td, th)[data-token] { white-space: nowrap; overflow-wrap: normal; word-break: normal; }
  /* chips / codes / badges inside table cells stay on one line (the table scrolls instead of stacking letters) */
  ${C} table :is(td, th) :is(.inline-flex, .font-mono, .rounded, .rounded-md, .rounded-full) { white-space: nowrap; }
  /* dialogs (pickers, confirmations, print previews) fit the screen and scroll */
  [role="dialog"] { max-width: calc(100vw - 1rem) !important; max-height: calc(100dvh - 1rem); overflow-y: auto; }
  /* grid cells may shrink below their content: long names wrap instead of pushing past the card */
  ${C} .grid > * { min-width: 0; overflow-wrap: break-word; }
  /* 4-12 column field grids become 2 columns */
  ${C} .grid:is(.grid-cols-4, .grid-cols-5, .grid-cols-6, .grid-cols-8, .grid-cols-12):has(input, select, textarea) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  ${C} .grid:is(.grid-cols-4, .grid-cols-5, .grid-cols-6, .grid-cols-8, .grid-cols-12):has(input, select, textarea) > * { grid-column: auto / span 1 !important; }
  /* scrollable tab / chip rows: items keep their natural width and the row scrolls (they used to shrink and overlap) */
  ${C} .overflow-x-auto:is(.flex, .inline-flex) > * { flex-shrink: 0; }
  /* right-to-left languages: table text follows the reading direction instead of a hard-coded left */
  :root[dir="rtl"] ${C} :is(table.text-left, table .text-left) { text-align: start; }

}

@media screen {
  /* ================= tables: never clip data on ANY screen size ================= */
  /* a container that directly wraps a table scrolls horizontally when the table is wider than it (laptops / narrow desktops
     included) instead of clipping the columns — only shows a scrollbar when it actually overflows, so tables that fit are
     unchanged. Overrides a hard-coded overflow-hidden on the x-axis only. */
  ${C} :has(> table) { overflow-x: auto; max-width: 100%; }

  /* ================= dark palette (near-black): Dark / System-at-night, every screen size ================= */
  ${D} {
    --background: 225 18% 4.5%;
    --foreground: 210 20% 96%;
    --card: 225 14% 8%;
    --card-foreground: 210 20% 96%;
    --popover: 225 14% 9%;
    --popover-foreground: 210 20% 96%;
    --secondary: 225 12% 13%;
    --secondary-foreground: 210 20% 96%;
    --muted: 225 12% 13%;
    --muted-foreground: 220 10% 64%;
    --border: 225 11% 17%;
    --input: 225 10% 23%;
    --mobile-label: 220 14% 82%;
  }
  ${D} body { background-color: hsl(var(--background)); color: hsl(var(--foreground)); }
  ${D} ${C} label { color: hsl(var(--mobile-label)); }
  ${D} ${C} ${FIELD}, ${D} ${C} select, ${D} ${C} textarea,
  ${D} [role="dialog"] ${FIELD}, ${D} [role="dialog"] select, ${D} [role="dialog"] textarea {
    background-color: hsl(var(--background)); border-color: hsl(var(--input) / 0.8); color: hsl(var(--foreground));
  }
  ${D} ${C} input::placeholder, ${D} ${C} textarea::placeholder { color: hsl(215 16% 47%); }
  ${D} ${C} input[readonly], ${D} ${C} input:disabled { background-color: hsl(var(--card)); color: hsl(var(--muted-foreground)); }
  /* light utilities hard-coded by older screens (an element's own dark: style still wins) */
    ${["", "\\/60", "\\/70", "\\/80", "\\/90", "\\/95"].map((a) => `${WD} .bg-white${a}`).join(", ")} { background-color: hsl(var(--card)); }
    ${WD} .bg-slate-50, ${WD} .bg-gray-50, ${WD} .bg-zinc-50, ${WD} .bg-neutral-50, ${WD} .bg-stone-50, ${WD} .bg-slate-50\\/50, ${WD} .bg-slate-50\\/60, ${WD} .bg-slate-50\\/70, ${WD} .bg-slate-50\\/80, ${WD} .bg-gray-50\\/50 { background-color: hsl(var(--background)); }
    ${WD} .bg-slate-100, ${WD} .bg-gray-100, ${WD} .bg-zinc-100, ${WD} .bg-neutral-100, ${WD} .bg-slate-200, ${WD} .bg-gray-200 { background-color: hsl(var(--muted)); }
    ${WD} .hover\\:bg-slate-50:hover, ${WD} .hover\\:bg-gray-50:hover, ${WD} .hover\\:bg-slate-100:hover, ${WD} .hover\\:bg-gray-100:hover, ${WD} .hover\\:bg-white:hover { background-color: hsl(var(--muted)); }
    ${WD} .text-black, ${WD} .text-slate-950, ${WD} .text-slate-900, ${WD} .text-gray-900, ${WD} .text-zinc-900, ${WD} .text-neutral-900, ${WD} .text-slate-800, ${WD} .text-gray-800 { color: hsl(var(--foreground)); }
    ${WD} .text-slate-700, ${WD} .text-gray-700, ${WD} .text-slate-600, ${WD} .text-gray-600, ${WD} .text-zinc-700 { color: hsl(var(--mobile-label)); }
    ${WD} .text-slate-500, ${WD} .text-gray-500, ${WD} .text-zinc-500 { color: hsl(var(--muted-foreground)); }
    ${WD} .border-slate-100, ${WD} .border-slate-200, ${WD} .border-slate-300, ${WD} .border-gray-100, ${WD} .border-gray-200, ${WD} .border-gray-300, ${WD} .border-zinc-200 { border-color: hsl(var(--border)); }
    ${WD} .divide-slate-100 > :not([hidden]) ~ :not([hidden]), ${WD} .divide-slate-200 > :not([hidden]) ~ :not([hidden]), ${WD} .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: hsl(var(--border)); }
${tint}${hexMap}${BASELINE}}

@media ${NAVBAR} {
  /* the floating chat button sits above the mobile bottom navigation instead of covering it */
  .fixed.bottom-4:has(> button[aria-haspopup], > button[aria-label]) { bottom: calc(5.25rem + env(safe-area-inset-bottom)); }
  /* content ends above the bottom navigation, Safari's toolbar and the home-indicator safe area */
  ${C} { padding-bottom: calc(6rem + env(safe-area-inset-bottom)) !important; }
}

@media ${PHONE} {
  /* ================= phones: one field per row, like the template's phone frame ================= */
  ${C} { padding: 0.625rem 0.625rem calc(6rem + env(safe-area-inset-bottom)) !important; }
  ${C} .grid:is(.grid-cols-2, .grid-cols-3, .grid-cols-4, .grid-cols-5, .grid-cols-6, .grid-cols-8, .grid-cols-12):has(input, select, textarea) { grid-template-columns: minmax(0, 1fr) !important; }
  ${C} .grid:is(.grid-cols-2, .grid-cols-3, .grid-cols-4, .grid-cols-5, .grid-cols-6, .grid-cols-8, .grid-cols-12):has(input, select, textarea) > * { grid-column: 1 / -1 !important; }
  /* rows of fields wrap instead of overflowing */
  ${C} .flex:not(.flex-col):has(> * > input, > * > select, > input, > select) { flex-wrap: wrap; }
  ${C} ${BTN}:not(table *) { min-height: 2.5rem; }
  ${C} h1 { font-size: 1.125rem; line-height: 1.5rem; }
  /* wizard step headers: one compact 4-across strip instead of four stacked cards */
  [data-studio-steps] { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.375rem; }
  [data-studio-steps] > button { flex-direction: column; gap: 0.25rem; padding: 0.5rem 0.25rem; text-align: center; min-height: 0; }
  [data-studio-steps] > button > div:first-child { height: 1.75rem; width: 1.75rem; }
  [data-studio-steps] > button > div:last-child > div:first-child { display: none; }
  [data-studio-steps] > button > div:last-child > div:last-child {
    white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; /* long names (e.g. "Employee & Operational Section") must read in full */
    font-size: 0.625rem; line-height: 0.8rem;
  }
}
`;
fs.writeFileSync(process.argv[2], css);
let d = 0; for (const ch of css) { if (ch === "{") d++; if (ch === "}") d--; if (d < 0) throw new Error("unbalanced"); }
if (d !== 0) throw new Error("unbalanced " + d);
console.log(css.split("\n").length, "lines, braces balanced");
