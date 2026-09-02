"use client";

import { printStore } from "@/lib/store/print-store";

/**
 * Safe replacement for the `document.body.innerHTML = fragment; window.print();
 * … ; window.location.reload()` anti-pattern.
 *
 * Takes an already-rendered on-screen block, strips every interactive / screen-only
 * control from a CLONE of it, forces a light print theme, wraps it in a minimal
 * self-contained A4 document and hands it to the shared `PdfPreviewModal`
 * (iframe — no body swap, no reload; the modal's Print / Save-as-PDF / orientation
 * / Email / WhatsApp actions all work).
 *
 * The output must read as a *document*, never as a screenshot of the app: no
 * buttons, inputs, dropdowns, filter tabs, search boxes, pagination, row-action
 * columns, or floating widgets.
 */
export function printDomFragmentViaModal(
  elementId: string,
  title: string,
  opts: { lang?: string; orientation?: "portrait" | "landscape" } = {},
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(elementId);
  if (!el) return false;

  const clone = el.cloneNode(true) as HTMLElement;

  // ── 1) Remove application chrome + interactive controls ────────────────────
  const STRIP = [
    // app chrome
    "[data-erp-page-actions]", "[data-print-exclude]", ".no-print", ".no-print-toolbar",
    ".screen-only", ".erp-no-print",
    "nav", "[role='navigation']", "#erp-page-actions-slot", "#erp-page-title-slot",
    "[data-dgt-connect]", "[data-radix-popper-content-wrapper]", "[data-floating-widget]",
    "[data-sonner-toaster]", "script", "style[data-emotion]",
    // interactive controls — never meaningful in a printed document
    "button", "input", "select", "textarea", "[contenteditable='true']",
    "[role='tab']", "[role='tablist']", "[role='search']", "[role='combobox']",
    "[role='menu']", "[role='menubar']", "[role='toolbar']", "[role='slider']",
    "[type='search']",
    // common class-name signatures for filter bars / search / pagination / actions
    ".pagination", "[aria-label*='pagination' i]", "[class*='paginat' i]",
    "[class*='filter-bar' i]", "[class*='toolbar' i]", "[data-search-filter]",
    "[data-table-actions]", "[data-row-actions]", "[data-scope-bar]", "[data-quick-access]",
  ];
  for (const sel of STRIP) {
    try {
      clone.querySelectorAll(sel).forEach((n) => n.remove());
    } catch {
      /* selector unsupported in this engine — skip it */
    }
  }

  // ── 1b) Remove screen-only widgets identified by their heading text ────────
  //   "Quick Access" / "Quick Actions" launcher cards and interactive scope /
  //   filter pill bars are navigation, not report content.
  const NAV_HEADINGS = /^\s*(quick access|quick actions|quick links|fast (branch )?operations|common (logistics )?workflows)\s*$/i;
  clone.querySelectorAll("h1,h2,h3,h4,h5,h6,[class*='uppercase']").forEach((h) => {
    if (!NAV_HEADINGS.test(h.textContent || "")) return;
    const card = h.closest("section,article,div");
    (card && card !== clone ? card : h).remove();
  });
  // Screen-only readiness / status pills ("Ready", "Beta", "New", "Coming soon")
  // on navigation launchers are not report content.
  clone.querySelectorAll("span,[class*='badge' i],[class*='pill' i]").forEach((n) => {
    if (n.children.length === 0 && /^\s*(ready|beta|new|soon|coming soon|wip)\s*$/i.test(n.textContent || "")) {
      n.remove();
    }
  });
  // Scope / filter pill rows: a container whose visible text is only a run of
  // "Word (CODE)" chips or whose label reads "… SCOPE:" / "… FILTERS".
  clone.querySelectorAll("div,section,ul").forEach((n) => {
    const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (!txt || txt.length > 600) return;
    if (/\b(country|city|branch|directory)\s*(scope|filters?)\s*:?/i.test(txt) &&
        (n.querySelectorAll("button,a").length >= 3 || /\([A-Z]{2,4}\)/.test(txt))) {
      n.remove();
    }
  });
  // Empty chart frames (axes + "No data" message) are noise in a printed report —
  // drop the whole chart card when it has no plotted data.
  clone.querySelectorAll("svg,canvas,[class*='recharts' i],[class*='chart' i]").forEach((g) => {
    const box = g.closest("div,section,article") || g;
    const t = (box.textContent || "").toLowerCase();
    if (/no (records?|data|results?)\b|no data available/.test(t) && t.replace(/no (records?|data|results?)[^a-z]*(found|available)?/gi, "").trim().length < 40) {
      (box !== clone ? box : g).remove();
    }
  });

  // ── 2) Drop the "Actions" column from data tables (header + each row cell) ──
  clone.querySelectorAll("table").forEach((table) => {
    const headRow = table.tHead?.rows?.[0] || table.rows?.[0];
    if (!headRow) return;
    const cells = Array.from(headRow.cells);
    const actionIdx = cells.findIndex((c) => {
      const t = (c.textContent || "").trim().toLowerCase();
      return t === "actions" || t === "action" || t === "" && c.querySelectorAll("button,a").length > 0;
    });
    if (actionIdx < 0) return;
    Array.from(table.rows).forEach((row) => {
      if (row.cells[actionIdx]) row.deleteCell(actionIdx);
    });
  });

  // ── 3) Collapse now-empty wrappers left behind by the strip pass ───────────
  for (let pass = 0; pass < 3; pass++) {
    clone.querySelectorAll("div, section, span, form, li, ul, header").forEach((n) => {
      if (!n.textContent?.trim() && n.children.length === 0 && !n.querySelector("img,svg,hr,table")) {
        n.remove();
      }
    });
  }

  const inner = clone.innerHTML;
  if (!inner || !inner.replace(/<[^>]+>/g, "").trim()) return false;

  const lang = opts.lang || (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  // A wide data table (7+ columns) does not fit A4 portrait — default to landscape
  // so columns are not clipped (the modal still lets the user flip it back).
  const widestTableCols = Math.max(
    0,
    ...Array.from(clone.querySelectorAll("table")).map((t) => {
      const hr = (t as HTMLTableElement).tHead?.rows?.[0] || (t as HTMLTableElement).rows?.[0];
      return hr ? hr.cells.length : 0;
    }),
  );
  const orientation = opts.orientation || (widestTableCols >= 7 ? "landscape" : "portrait");

  // Pull the page's stylesheets so Tailwind utility classes still resolve, but
  // override them below to guarantee a light, ink-friendly document.
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((n) => !n.hasAttribute("data-emotion"))
    .map((n) => n.outerHTML)
    .join("\n");

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${title.replace(/[<>&"]/g, "")}</title>
${styleLinks}
<style>
  @page { size: A4 ${orientation}; margin: 12mm; }
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #fff !important; color: #111 !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 12px; }
  /* Force a light document regardless of the app's active (often dark) theme */
  #__frag, #__frag * {
    background-image: none !important;
    box-shadow: none !important;
    color: #111 !important;
    border-color: #d1d5db !important;
  }
  #__frag [class*="bg-"], #__frag [style*="background"] { background-color: #fff !important; }
  #__frag [class*="bg-slate-9"], #__frag [class*="bg-gray-9"], #__frag [class*="bg-neutral-9"],
  #__frag [class*="bg-zinc-9"], #__frag [class*="bg-black"], #__frag [class*="from-slate"],
  #__frag [class*="to-indigo"], #__frag [class*="via-slate"] { background: #f8fafc !important; }
  #__frag table { width: 100%; border-collapse: collapse; table-layout: auto; }
  #__frag th, #__frag td { border: 1px solid #d1d5db !important; padding: 3px 5px !important; text-align: ${isRtl ? "right" : "left"}; font-size: ${widestTableCols >= 9 ? "9px" : "10px"}; }
  /* headers keep whole words — never fragment "COUNTRY" into "COU / NTR / Y" */
  #__frag th { white-space: nowrap; overflow-wrap: normal; word-break: keep-all; }
  /* cells wrap only at natural break points, and only break long unbroken tokens */
  #__frag td { overflow-wrap: break-word; word-break: normal; }
  #__frag thead th { background: #f1f5f9 !important; font-weight: 700; }
  #__frag thead { display: table-header-group; }
  #__frag tr { page-break-inside: avoid; break-inside: avoid; }
  #__frag .overflow-x-auto, #__frag [class*="overflow-x"],
  #__frag [class*="overflow-y"], #__frag [class*="overflow-auto"], #__frag [class*="overflow-scroll"] {
    overflow: visible !important; max-height: none !important; height: auto !important;
  }
  #__frag img, #__frag svg { max-width: 100%; }
  /* Headings: scale to the print column and wrap at a balanced point rather than
     leaving a single orphan word ("… Communication / Centre") on its own line */
  #__frag h1 { font-size: 19px !important; line-height: 1.25 !important; }
  #__frag h2 { font-size: 15px !important; line-height: 1.3 !important; }
  #__frag h1, #__frag h2, #__frag h3 { text-wrap: balance; overflow-wrap: break-word; }
  #__frag button, #__frag input, #__frag select, #__frag textarea { display: none !important; }
  /* Keep whole cards / widgets together across page breaks */
  #__frag [class*="rounded-xl"], #__frag [class*="rounded-2xl"],
  #__frag [class*="rounded-lg"][class*="border"], #__frag [data-card] {
    page-break-inside: avoid; break-inside: avoid;
  }
  /* KPI / stat card rows: keep a compact single band instead of a tall 3x2 grid */
  #__frag [class*="grid-cols-"] { gap: 6px !important; }
  #__frag [class*="md:grid-cols-4"], #__frag [class*="lg:grid-cols-4"],
  #__frag [class*="md:grid-cols-6"], #__frag [class*="lg:grid-cols-6"],
  #__frag [class*="sm:grid-cols-6"], #__frag [class*="xl:grid-cols-6"] {
    display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
  .no-print, .no-print-toolbar { display: none !important; }
  #__frag { padding: 4mm; }
  @media print { #__frag { padding: 0; } }
</style>
</head>
<body><div id="__frag">${inner}</div></body>
</html>`;

  printStore.openPrint(html, title);
  return true;
}
