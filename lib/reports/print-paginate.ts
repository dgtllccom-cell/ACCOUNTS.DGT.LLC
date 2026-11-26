/**
 * Real A4 pagination for the shared print / PDF preview (`PdfPreviewModal`).
 *
 * The preview used to show a single A4-sized iframe with `overflow:hidden`: everything past the
 * first sheet (and every column past the paper width) was silently clipped while the toolbar said
 * "Page 1 of 1". This module turns any printable document into a stack of fixed-size A4 sheets —
 * exactly like a spreadsheet printout:
 *
 *  - fit to width: content wider than the printable width is scaled down uniformly (never clipped);
 *  - flow: blocks are packed top-to-bottom; a block that does not fit moves to the next sheet;
 *    tall containers are split between their children (the ancestor chain is re-opened on the
 *    next sheet, so borders / backgrounds continue);
 *  - tables are split between rows only (a row is never cut in half) and the `<thead>` (or the
 *    leading all-`<th>` rows) is repeated on every sheet; `<tfoot>` stays with the last rows;
 *  - every sheet gets a localized "Page X of N" footer.
 *
 * The same sheets are shown in the preview, sent to the browser print dialog and rasterised into
 * the downloaded PDF, so all three are identical.
 *
 * The module is DOM-only (no React) and the measurement functions are injectable, so the packing
 * logic is unit tested in jsdom (tests/reports/print-paginate.test.ts).
 */

export type PaperOrientation = "portrait" | "landscape";

export type PaginateOptions = {
  orientation: PaperOrientation;
  rtl: boolean;
  /** "Page {current} of {total}" already localized */
  pageLabel: (current: number, total: number) => string;
  /** printable margin on every side, mm (default 7) */
  marginMm?: number;
  /** height reserved for the page-number footer, mm (default 6) */
  footerMm?: number;
  /** smallest fit-to-width scale (default 0.4) */
  minScale?: number;
  /** element whose children are paginated (default: `#__frag`, else `<body>`) */
  root?: HTMLElement | null;
  /** layout height of an element in CSS px (default `offsetHeight`) — injectable for tests */
  measureHeight?: (el: HTMLElement) => number;
  /** natural (overflowing) width of an element in CSS px (default `scrollWidth`) */
  measureWidth?: (el: HTMLElement) => number;
  /** vertical stacking test for a container (default: computed style) */
  stacksVertically?: (el: HTMLElement) => boolean;
};

export type PaginateResult = {
  pageCount: number;
  /** fit-to-width scale applied to the content (1 = no scaling) */
  scale: number;
  pageWidthPx: number;
  pageHeightPx: number;
  /** gap between sheets on screen, CSS px */
  gapPx: number;
};

export const MM_TO_PX = 96 / 25.4;
export const PAGE_GAP_PX = 24;

export function paperSizeMm(orientation: PaperOrientation) {
  return orientation === "landscape" ? { w: 297, h: 210 } : { w: 210, h: 297 };
}

export function paperSizePx(orientation: PaperOrientation) {
  const mm = paperSizeMm(orientation);
  return { w: mm.w * MM_TO_PX, h: mm.h * MM_TO_PX };
}

/** Marks a document as "paginate me in the preview". */
export const PAGINATE_ATTR = "data-erp-paginate";
export const PAGINATED_ATTR = "data-erp-paginated";

export function wantsPagination(html: string): boolean {
  return new RegExp(`<html\\b[^>]*\\b${PAGINATE_ATTR}=["']?true`, "i").test(html || "");
}

const SPLITTABLE_TAGS = new Set([
  "DIV", "SECTION", "ARTICLE", "MAIN", "FORM", "UL", "OL", "DL", "HEADER", "FOOTER", "ASIDE", "FIELDSET", "FIGURE", "BLOCKQUOTE",
]);

function defaultStacksVertically(el: HTMLElement): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  const cs = view.getComputedStyle(el);
  const d = cs.display;
  if (d === "block" || d === "flow-root" || d === "list-item" || d === "") return true;
  if (d === "flex" || d === "inline-flex") return cs.flexDirection === "column" || cs.flexDirection === "column-reverse";
  if (d === "grid" || d === "inline-grid") {
    const tracks = (cs.gridTemplateColumns || "").trim();
    return tracks === "" || tracks === "none" || tracks.split(/\s+/).length === 1;
  }
  return false;
}

function isWhitespaceText(n: Node) {
  return n.nodeType === 3 && !(n.textContent || "").trim();
}

/** Header rows of a table: its <thead> rows, or the leading rows made only of <th> cells. */
function headerRowsOf(table: HTMLTableElement): HTMLTableRowElement[] {
  if (table.tHead) return Array.from(table.tHead.rows);
  const out: HTMLTableRowElement[] = [];
  for (const row of Array.from(table.rows)) {
    const cells = Array.from(row.cells);
    if (cells.length && cells.every((c) => c.tagName === "TH")) out.push(row);
    else break;
  }
  return out;
}

export function paginateDocument(doc: Document, opts: PaginateOptions): PaginateResult {
  const root = opts.root ?? doc.getElementById("__frag") ?? doc.body;
  const marginMm = opts.marginMm ?? 7;
  const footerMm = opts.footerMm ?? 6;
  const minScale = opts.minScale ?? 0.4;
  const measureHeight = opts.measureHeight ?? ((el: HTMLElement) => el.offsetHeight);
  const measureWidth = opts.measureWidth ?? ((el: HTMLElement) => el.scrollWidth);
  const stacksVertically = opts.stacksVertically ?? defaultStacksVertically;
  const mm = paperSizeMm(opts.orientation);
  const px = paperSizePx(opts.orientation);
  const contentWidthPx = (mm.w - marginMm * 2) * MM_TO_PX;
  const contentHeightPx = (mm.h - marginMm * 2 - footerMm) * MM_TO_PX;

  // Source content: detach the root's children; the root keeps its id/classes so the report's
  // own stylesheet (`#__frag table …`) still applies to the sheets built inside it.
  const sourceNodes = Array.from(root.childNodes).filter((n) => !isWhitespaceText(n) && n.nodeName !== "SCRIPT");
  root.innerHTML = "";
  root.setAttribute(PAGINATED_ATTR, "true");
  doc.documentElement.setAttribute(PAGINATED_ATTR, "true");

  const pagesEl = doc.createElement("div");
  pagesEl.className = "erp-pages";
  root.appendChild(pagesEl);

  // ── 1) Fit to width ─────────────────────────────────────────────────────────────
  const probe = doc.createElement("div");
  probe.className = "erp-page-body erp-page-probe";
  probe.style.width = `${contentWidthPx}px`;
  pagesEl.appendChild(probe);
  sourceNodes.forEach((n) => probe.appendChild(n.cloneNode(true)));
  const naturalWidth = Math.max(contentWidthPx, measureWidth(probe));
  let scale = Math.min(1, contentWidthPx / naturalWidth);
  scale = Math.max(minScale, Math.round(scale * 1000) / 1000);
  const bodyWidthPx = contentWidthPx / scale;
  const budget = contentHeightPx / scale;
  probe.innerHTML = "";
  probe.style.width = `${bodyWidthPx}px`;

  const standaloneHeight = (el: Node) => {
    probe.innerHTML = "";
    probe.appendChild(el.cloneNode(true));
    const h = measureHeight(probe);
    probe.innerHTML = "";
    return h;
  };

  // ── 2) Flow packing ─────────────────────────────────────────────────────────────
  type ChainEntry = { src: HTMLElement; clone: HTMLElement };
  const chain: ChainEntry[] = [];
  const pages: HTMLElement[] = [];
  let body!: HTMLElement;
  let placedOnPage = 0;

  const container = (): HTMLElement => (chain.length ? chain[chain.length - 1].clone : body);
  const overflows = () => measureHeight(body) > budget + 0.5;

  const pruneEmptyShells = () => {
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const c = chain[i].clone;
      if (!c.childNodes.length) c.remove();
    }
  };

  const newPage = () => {
    if (body) pruneEmptyShells();
    const page = doc.createElement("div");
    page.className = "erp-page";
    page.setAttribute("dir", opts.rtl ? "rtl" : "ltr");
    const inner = doc.createElement("div");
    inner.className = "erp-page-inner";
    const b = doc.createElement("div");
    b.className = "erp-page-body";
    b.style.width = `${bodyWidthPx}px`;
    if (scale < 1) b.style.transform = `scale(${scale})`;
    inner.appendChild(b);
    const footer = doc.createElement("div");
    footer.className = "erp-page-footer";
    page.appendChild(inner);
    page.appendChild(footer);
    pagesEl.insertBefore(page, probe);
    pages.push(page);
    body = b;
    placedOnPage = 0;
    // re-open the ancestor chain on the new sheet
    let parent: HTMLElement = body;
    for (const entry of chain) {
      const shell = entry.src.cloneNode(false) as HTMLElement;
      shell.removeAttribute("id");
      parent.appendChild(shell);
      entry.clone = shell;
      parent = shell;
    }
  };

  const appendAtomic = (node: Node) => {
    const clone = node.cloneNode(true);
    container().appendChild(clone);
    if (!overflows()) {
      placedOnPage += 1;
      return;
    }
    clone.parentNode?.removeChild(clone);
    if (placedOnPage > 0) newPage();
    container().appendChild(node.cloneNode(true)); // oversized on an empty sheet: place it anyway
    placedOnPage += 1;
  };

  const placeTable = (table: HTMLTableElement) => {
    const headRows = headerRowsOf(table);
    const headSet = new Set<Element>(headRows);
    const footRows = table.tFoot ? Array.from(table.tFoot.rows) : [];
    const footSet = new Set<Element>(footRows);
    const bodyRows = Array.from(table.rows).filter((r) => !headSet.has(r) && !footSet.has(r));

    let shell!: HTMLTableElement;
    let tbody!: HTMLElement;
    let rowsInShell = 0;
    let currentSection: Element | null = null;

    const makeShell = () => {
      shell = table.cloneNode(false) as HTMLTableElement;
      shell.removeAttribute("id");
      Array.from(table.children).forEach((c) => {
        if (c.tagName === "CAPTION" || c.tagName === "COLGROUP") shell.appendChild(c.cloneNode(true));
      });
      if (headRows.length) {
        const thead = (table.tHead ? table.tHead.cloneNode(false) : doc.createElement("thead")) as HTMLElement;
        headRows.forEach((r) => thead.appendChild(r.cloneNode(true)));
        shell.appendChild(thead);
      }
      currentSection = null;
      rowsInShell = 0;
      container().appendChild(shell);
    };
    const sectionFor = (row: HTMLTableRowElement) => {
      const sec = row.parentElement;
      if (!tbody || sec !== currentSection) {
        tbody = (sec && sec.tagName === "TBODY" ? sec.cloneNode(false) : doc.createElement("tbody")) as HTMLElement;
        shell.appendChild(tbody);
        currentSection = sec;
      }
      return tbody;
    };
    const breakTable = () => {
      newPage();
      makeShell();
    };

    makeShell();
    if (overflows() && placedOnPage > 0) {
      shell.remove();
      breakTable();
    }
    const pageHadContentBeforeTable = () => placedOnPage > 0;

    for (const row of bodyRows) {
      const tb = sectionFor(row);
      const clone = row.cloneNode(true);
      tb.appendChild(clone);
      if (!overflows()) {
        rowsInShell += 1;
        continue;
      }
      tb.removeChild(clone);
      if (rowsInShell === 0 && !pageHadContentBeforeTable()) {
        tb.appendChild(row.cloneNode(true)); // a single row taller than a sheet: keep it whole
        rowsInShell += 1;
        continue;
      }
      if (rowsInShell === 0) shell.remove();
      breakTable();
      sectionFor(row).appendChild(row.cloneNode(true));
      rowsInShell += 1;
    }

    if (footRows.length) {
      const tfoot = table.tFoot!.cloneNode(true) as HTMLElement;
      shell.appendChild(tfoot);
      if (overflows() && rowsInShell > 0) {
        tfoot.remove();
        // carry the last row over so the totals never sit alone at the top of a sheet
        const last = tbody?.lastElementChild;
        if (last && rowsInShell > 1) last.remove();
        breakTable();
        if (last && rowsInShell > 1) sectionFor(last as HTMLTableRowElement).appendChild(last);
        shell.appendChild(tfoot);
      }
    }
    // drop an empty tbody shell left behind by a section switch
    shell.querySelectorAll("tbody").forEach((tb) => {
      if (!tb.children.length) tb.remove();
    });
    placedOnPage += 1;
  };

  const place = (node: Node) => {
    if (node.nodeType !== 1) {
      if (!isWhitespaceText(node)) appendAtomic(node);
      return;
    }
    const el = node as HTMLElement;
    if (el.tagName === "TABLE") {
      placeTable(el as HTMLTableElement);
      return;
    }
    const clone = el.cloneNode(true) as HTMLElement;
    container().appendChild(clone);
    if (!overflows()) {
      placedOnPage += 1;
      return;
    }
    clone.remove();

    const kids = Array.from(el.childNodes).filter((n) => !isWhitespaceText(n));
    const splittable =
      SPLITTABLE_TAGS.has(el.tagName) && kids.some((k) => k.nodeType === 1) && stacksVertically(el);
    const fitsAlone = standaloneHeight(el) <= budget;
    const hasTable = !!el.querySelector("table");
    // Keep a card / panel together when it fits on a fresh sheet; long tables flow on instead
    // of leaving a half-empty page.
    if (!splittable || (fitsAlone && (!hasTable || placedOnPage === 0))) {
      appendAtomic(el);
      return;
    }
    const shell = el.cloneNode(false) as HTMLElement;
    container().appendChild(shell);
    chain.push({ src: el, clone: shell });
    kids.forEach((k) => place(k));
    chain.pop();
    if (!shell.childNodes.length) shell.remove();
  };

  newPage();
  sourceNodes.forEach((n) => place(n));
  pruneEmptyShells();
  probe.remove();

  // drop a trailing blank sheet (can only happen if the last block moved and was empty)
  while (pages.length > 1 && !pages[pages.length - 1].querySelector(".erp-page-body")!.childNodes.length) {
    pages.pop()!.remove();
  }

  const total = pages.length;
  pages.forEach((p, i) => {
    p.setAttribute("data-page", String(i + 1));
    const f = p.querySelector(".erp-page-footer");
    if (f) f.textContent = opts.pageLabel(i + 1, total);
  });

  return { pageCount: total, scale, pageWidthPx: px.w, pageHeightPx: px.h, gapPx: PAGE_GAP_PX };
}

/**
 * Stylesheet for the paginated sheets (screen preview = print = PDF). `scope` is the selector of
 * the pagination root (e.g. `#__frag`) so these rules beat the report's own `#__frag *` resets.
 */
export function paginatedSheetCss(orientation: PaperOrientation, opts: { rtl: boolean; scope?: string; marginMm?: number; footerMm?: number }) {
  const mm = paperSizeMm(orientation);
  const margin = opts.marginMm ?? 7;
  const footer = opts.footerMm ?? 6;
  const s = opts.scope || "body";
  return `
  @page { size: A4 ${orientation}; margin: 0; }
  html[${PAGINATED_ATTR}], html[${PAGINATED_ATTR}] body { margin:0 !important; padding:0 !important; }
  ${s}[${PAGINATED_ATTR}] { padding:0 !important; margin:0 !important; width:auto !important; max-width:none !important; }
  ${s} .erp-pages { display:flex !important; flex-direction:column !important; align-items:center !important; gap:${PAGE_GAP_PX}px !important; padding:0 !important; margin:0 !important; background:transparent !important; }
  ${s} .erp-pages > .erp-page {
    position:relative !important; box-sizing:border-box !important; flex:0 0 auto !important;
    width:${mm.w}mm !important; height:${mm.h}mm !important; min-height:0 !important; max-height:none !important;
    margin:0 !important; padding:0 !important; overflow:hidden !important; background:#fff !important;
    page-break-inside:avoid !important; break-inside:avoid !important;
  }
  ${s} .erp-page > .erp-page-inner {
    position:absolute !important; top:${margin}mm !important; left:${margin}mm !important; right:${margin}mm !important; bottom:${margin + footer}mm !important;
    overflow:hidden !important; background:#fff !important; margin:0 !important; padding:0 !important;
  }
  ${s} .erp-page-body {
    display:flow-root !important; box-sizing:border-box !important; height:auto !important; max-height:none !important;
    margin:0 !important; padding:0 !important; background:#fff !important;
    transform-origin:top ${opts.rtl ? "right" : "left"} !important;
  }
  ${s} .erp-page-probe { position:absolute !important; visibility:hidden !important; left:0 !important; top:0 !important; }
  ${s} .erp-page > .erp-page-footer {
    position:absolute !important; left:${margin}mm !important; right:${margin}mm !important; bottom:${Math.max(2, margin - 2)}mm !important;
    height:${footer}mm !important; display:flex !important; align-items:flex-end !important; justify-content:flex-end !important;
    font:600 9px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif !important; color:#475569 !important;
    background:transparent !important; border:0 !important;
  }
  ${s} .erp-page-body table { width:100% !important; }
  ${s} .erp-page-body thead { display:table-header-group !important; }
  ${s} .erp-page-body tr { break-inside:avoid !important; page-break-inside:avoid !important; }
  @media screen {
    html[${PAGINATED_ATTR}], html[${PAGINATED_ATTR}] body { background:transparent !important; overflow:hidden !important; height:auto !important; }
    ${s} .erp-pages > .erp-page { box-shadow:0 6px 24px rgba(0,0,0,.35) !important; }
  }
  @media print {
    html[${PAGINATED_ATTR}], html[${PAGINATED_ATTR}] body { background:#fff !important; }
    ${s} .erp-pages { display:block !important; gap:0 !important; }
    ${s} .erp-pages > .erp-page { box-shadow:none !important; break-after:page !important; page-break-after:always !important; }
    ${s} .erp-pages > .erp-page:last-child { break-after:auto !important; page-break-after:auto !important; }
  }
  `;
}

/** Wait (bounded) for fonts and images so measurements match the final rendering. */
export async function waitForDocumentAssets(doc: Document, timeoutMs = 2500): Promise<void> {
  const timeout = new Promise<void>((r) => setTimeout(r, timeoutMs));
  const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
  const imgs = Array.from(doc.images || []).filter((img) => !img.complete).map(
    (img) => new Promise<void>((r) => { img.addEventListener("load", () => r(), { once: true }); img.addEventListener("error", () => r(), { once: true }); }),
  );
  await Promise.race([Promise.all([fonts.catch(() => undefined), ...imgs]).then(() => undefined), timeout]);
}

/** Rasterise the paginated sheets of `doc` into an A4 PDF (identical to the preview). */
export async function downloadPaginatedSheetsPdf(doc: Document, orientation: PaperOrientation, filename: string): Promise<void> {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(".erp-pages > .erp-page"));
  if (!pages.length) throw new Error("no paginated sheets");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const mm = paperSizeMm(orientation);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const win = doc.defaultView;
  for (let i = 0; i < pages.length; i += 1) {
    const rect = pages[i].getBoundingClientRect();
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: doc.documentElement.scrollHeight,
      scrollX: -(win?.scrollX ?? 0),
      scrollY: -(win?.scrollY ?? 0),
    });
    if (i > 0) pdf.addPage("a4", orientation);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, mm.w, mm.h);
  }
  pdf.save(filename);
}

/**
 * Make the document's CSS identical on screen and on paper.
 *
 * The app's stylesheets carry `@media screen …` rules (e.g. a 13.5px root font-size on laptop
 * widths) and `@media print …` rules (10pt body, table padding, hidden header/aside). If the
 * sheets were measured with one set and printed with the other, rows would grow on paper and the
 * bottom rows of every sheet would be clipped. So every same-origin stylesheet is replaced, in
 * place and in order, by an inline `<style>` in which every `@media` block (screen, print, width
 * breakpoints) is frozen as evaluated now at the sheet-width viewport — rules that apply are kept
 * unconditionally, the others dropped — with `screen` / `print` read as `all`.
 * Being real `<style>` text, this also survives every copy of the document (the html2canvas
 * clone for the PDF, the thumbnails, the HTML download). `url(…)` references are made absolute.
 * The pagination stylesheet (`data-erp-sheet-css`) keeps its own screen / print split.
 */
export function unifyScreenAndPrintCss(doc: Document): void {
  if (doc.documentElement.hasAttribute("data-erp-css-unified")) return;
  const toAll = (mediaText: string) =>
    mediaText
      .split(",")
      .map((q) => q.trim().replace(/^(only\s+)?(screen|print)\b/i, "all"))
      .join(", ");
  const view = doc.defaultView;
  const serialize = (rules: CSSRuleList, base: string | null): string =>
    Array.from(rules)
      .map((rule) => {
        const media = (rule as CSSMediaRule).media;
        let text: string;
        if (media && (rule as CSSMediaRule).cssRules && /^@media/i.test(rule.cssText)) {
          // Freeze the condition as evaluated now (sheet-width viewport): keep the rules that
          // apply, drop the others — paper must not re-evaluate width / screen conditions.
          const query = toAll(media.mediaText);
          let matches = false;
          try { matches = !!view?.matchMedia(query).matches; } catch { matches = false; }
          text = matches ? serialize((rule as CSSMediaRule).cssRules, base) : "";
        } else if ((rule as CSSGroupingRule).cssRules && /^@(layer|supports)\b/i.test(rule.cssText)) {
          // recurse so @media blocks nested in @layer (Tailwind v4) / @supports are frozen too
          const prelude = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
          text = `${prelude} {\n${serialize((rule as CSSGroupingRule).cssRules, base)}\n}`;
        } else {
          text = rule.cssText;
        }
        if (base) {
          text = text.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
            if (/^(data:|https?:|blob:|#)/i.test(u)) return m;
            try { return `url("${new URL(u, base).href}")`; } catch { return m; }
          });
        }
        return text;
      })
      .join("\n");

  for (const sheet of Array.from(doc.styleSheets || [])) {
    const owner = sheet.ownerNode as Element | null;
    if (!owner || owner.getAttribute?.("data-erp-sheet-css")) continue;
    let css: string;
    try {
      css = serialize(sheet.cssRules, sheet.href);
    } catch {
      continue; // cross-origin stylesheet: leave it as is
    }
    const sheetMedia = sheet.media?.mediaText || "";
    const style = doc.createElement("style");
    style.setAttribute("data-erp-unified-css", "true");
    if (sheetMedia && !/^all$/i.test(sheetMedia)) {
      let on = false;
      try { on = !!view?.matchMedia(toAll(sheetMedia)).matches; } catch { on = false; }
      if (!on) css = "";
    }
    style.textContent = css;
    owner.replaceWith(style);
  }
  doc.documentElement.setAttribute("data-erp-css-unified", "true");
}
