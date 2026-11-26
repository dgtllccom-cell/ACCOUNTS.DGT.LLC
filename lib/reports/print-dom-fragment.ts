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
  // Reveal explicitly marked report content in the printable copy only.
  clone.querySelectorAll<HTMLElement>("[hidden][data-print-only]").forEach((node) => {
    node.removeAttribute("hidden");
    node.style.removeProperty("display");
  });

  // ── 0) A button that carries document data (a bill no. you click to open the bill) prints as its text ──────
  clone.querySelectorAll<HTMLElement>("[data-print-text]").forEach((b) => {
    const span = document.createElement("span");
    span.textContent = b.textContent || "";
    span.className = "font-bold";
    b.replaceWith(span);
  });

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
  //   Multi-row headers (a group row "MASTER REFERENCE | … | ACTIONS" above the leaf row) are
  //   handled by LOGICAL column position (colSpan aware): the old code looked at the group row
  //   only and deleted the wrong physical cell in every row.
  clone.querySelectorAll("table").forEach((table) => removeActionColumns(table as HTMLTableElement));

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
  const widestTableCols = Math.max(0, ...Array.from(clone.querySelectorAll("table")).map((t) => logicalColumnCount(t as HTMLTableElement)));
  const orientation = opts.orientation || (widestTableCols >= 7 ? "landscape" : "portrait");

  // Pull the page's stylesheets so Tailwind utility classes still resolve, but
  // override them below to guarantee a light, ink-friendly document.
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((n) => !n.hasAttribute("data-emotion"))
    .map((n) => n.outerHTML)
    .join("\n");

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}" data-erp-paginate="true">
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
  #__frag th { white-space: ${widestTableCols >= 12 ? "normal" : "nowrap"}; overflow-wrap: normal; word-break: keep-all; }
  /* (12+ columns cannot fit A4 landscape on one heading line each: they wrap BETWEEN words, never inside one) */
  /* cells wrap only at natural break points, and only break long unbroken tokens */
  #__frag td { overflow-wrap: break-word; word-break: normal; }
  #__frag thead th { background: #f1f5f9 !important; font-weight: 700; }
  #__frag thead { display: table-header-group; }
  #__frag tr { page-break-inside: avoid; break-inside: avoid; }
  #__frag .overflow-x-auto, #__frag [class*="overflow-x"],
  #__frag [class*="overflow-y"], #__frag [class*="overflow-auto"], #__frag [class*="overflow-scroll"] {
    overflow: visible !important; max-height: none !important; height: auto !important;
  }
  /* Spreadsheet-style print: screen-only minimum widths (min-w-[1700px] scroll tables) must not
     force the table wider than the paper — the preview fits whatever remains to the page width. */
  #__frag table, #__frag th, #__frag td { min-width: 0 !important; max-width: none !important; }
  #__frag thead, #__frag thead th, #__frag [class*="sticky"] { position: static !important; }
  #__frag tbody tr:nth-child(even) > td { background-color: #f8fafc !important; }
  #__frag thead tr:not(:last-child) th { background: #e2e8f0 !important; text-align: center; }
  #__frag td [class*="rounded"], #__frag td [class*="border"] { border: 0 !important; padding: 0 !important; background: transparent !important; }
  #__frag details > :not(summary) { display: none !important; }
  #__frag summary { list-style: none !important; }
  #__frag summary::-webkit-details-marker, #__frag summary::marker { display: none !important; content: "" !important; }
  #__frag img, #__frag svg { max-width: 100%; }
  /* Headings: scale to the print column and wrap at a balanced point rather than
     leaving a single orphan word ("… Communication / Centre") on its own line */
  #__frag h1 { font-size: 19px !important; line-height: 1.25 !important; }
  #__frag h2 { font-size: 15px !important; line-height: 1.3 !important; }
  #__frag h1, #__frag h2, #__frag h3 { text-wrap: balance; overflow-wrap: break-word; }
  #__frag button, #__frag input, #__frag select, #__frag textarea { display: none !important; }
  /* a printed document shows whole values: no on-screen ellipsis ("United Arab Emira…") */
  #__frag .truncate { overflow: visible !important; white-space: normal !important; text-overflow: clip !important; max-width: none !important; }
  /* Multi-page document pagination: allow voucher root and large document containers to paginate cleanly */
  #__frag, #__frag > div, #sales-booking-voucher-root, [data-printable-document] {
    page-break-inside: auto !important;
    break-inside: auto !important;
    height: auto !important;
    max-height: none !important;
  }
  /* Keep whole sub-cards / widgets together across page breaks */
  #__frag [class*="rounded-xl"]:not(#sales-booking-voucher-root),
  #__frag [class*="rounded-2xl"]:not(#sales-booking-voucher-root),
  #__frag [class*="rounded-lg"][class*="border"]:not(#sales-booking-voucher-root),
  #__frag [data-card] {
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
  @media print {
    #__frag { padding: 0; }
    .page-break-before { page-break-before: always; break-before: page; }
    .page-break-after { page-break-after: always; break-after: page; }
  }
</style>
</head>
<body><div id="__frag">${inner}</div></body>
</html>`;

  printStore.openPrint(html, title);
  return true;
}

/** Number of logical columns of a table (the widest header/body row, colSpan aware). */
export function logicalColumnCount(table: HTMLTableElement): number {
  let max = 0;
  Array.from(table.rows).forEach((row) => {
    const n = Array.from(row.cells).reduce((sum, c) => sum + Math.max(1, c.colSpan || 1), 0);
    if (n > max) max = n;
  });
  return max;
}

function cellAtLogicalColumn(row: HTMLTableRowElement, col: number): HTMLTableCellElement | null {
  let pos = 0;
  for (const cell of Array.from(row.cells)) {
    const span = Math.max(1, cell.colSpan || 1);
    if (col >= pos && col < pos + span) return cell;
    pos += span;
  }
  return null;
}

/**
 * Remove "Actions" columns (header label "Action(s)", or an empty header over buttons/links)
 * from a table. Works on the leaf header row by logical column index; spanning group cells are
 * narrowed (colSpan − 1) instead of deleted.
 */
export function removeActionColumns(table: HTMLTableElement): void {
  const headRows = table.tHead ? Array.from(table.tHead.rows) : table.rows[0] ? [table.rows[0]] : [];
  const leaf = headRows[headRows.length - 1];
  if (!leaf) return;
  const actionCols: number[] = [];
  let pos = 0;
  for (const c of Array.from(leaf.cells)) {
    const span = Math.max(1, c.colSpan || 1);
    const txt = (c.textContent || "").trim().toLowerCase();
    if (span === 1 && (txt === "actions" || txt === "action" || (txt === "" && c.querySelectorAll("button,a").length > 0))) {
      actionCols.push(pos);
    }
    pos += span;
  }
  // remove right-to-left so earlier logical indexes stay valid
  actionCols.sort((a, b) => b - a).forEach((col) => {
    Array.from(table.rows).forEach((row) => {
      const cell = cellAtLogicalColumn(row, col);
      if (!cell) return;
      if (cell.colSpan > 1) cell.colSpan -= 1;
      else cell.remove();
    });
  });
}
