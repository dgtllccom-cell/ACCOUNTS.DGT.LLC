/**
 * Full-data PDF download for ERP report HTML (both print engines).
 *
 * The report is loaded into a hidden iframe, its main data table is split into A4 pages
 * (repeating the column header on every page, keeping the letterhead/filters on page 1 and the
 * totals + signatures on the last page, and stamping "PAGE x / N"), then rasterised with
 * html2pdf. Rasterising in the browser keeps Arabic / Urdu / Persian / Pashto shaping and RTL
 * layout exactly as previewed. Nothing is clipped: every row of the table is included.
 */

export type PaginatedPdfOptions = {
  html: string;
  orientation: "portrait" | "landscape";
  filename: string;
  /** localized "PAGE" word for the page marker */
  pageWord: string;
  rtl: boolean;
};

const PX_W = { landscape: 1123, portrait: 794 } as const;
const PX_H = { landscape: 794, portrait: 1123 } as const;
const MARGIN = 23; // ~6mm
const MARKER_H = 18;

function pruneToPage(root: HTMLElement, table: HTMLElement, mode: { keepBefore: boolean; keepAfter: boolean }) {
  // Walk up from the table and drop siblings before/after at every ancestor level.
  let node: HTMLElement | null = table;
  while (node && node !== root) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    const kids = Array.from(parent.children);
    const idx = kids.indexOf(node);
    kids.forEach((k, i) => {
      if (i < idx && !mode.keepBefore) k.remove();
      if (i > idx && !mode.keepAfter) k.remove();
    });
    node = parent;
  }
}

export async function renderPaginatedPdf(opts: PaginatedPdfOptions): Promise<void> {
  const { orientation } = opts;
  const W = PX_W[orientation];
  const H = PX_H[orientation];

  // Apply the report's print rules on screen (larger print typography, hidden toolbars).
  const html = opts.html.replace(/@media\s+print/gi, "@media all");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;border:0;visibility:hidden;`;
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) throw new Error("pdf iframe unavailable");
    try {
      await (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* fonts are best effort */
    }

    const table = doc.querySelector<HTMLElement>("table.data-table, table.report-table");
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) throw new Error("no data table to paginate");

    const style = doc.createElement("style");
    style.textContent = `
      html, body { width:${W}px !important; margin:0 !important; padding:0 !important; background:#fff !important; overflow:visible !important; height:auto !important; }
      .no-print-toolbar, .custom-modal-overlay, .toolbar, .screen-only { display:none !important; }
      .wrap { display:block !important; padding:0 !important; margin:0 !important; min-height:0 !important; background:#fff !important; width:${W - MARGIN * 2}px !important; }
      .sheet-scalable-viewport { transform:none !important; width:100% !important; max-width:none !important; }
      .sheet { width:100% !important; max-width:none !important; height:auto !important; min-height:0 !important; overflow:visible !important; border:none !important; box-shadow:none !important; border-radius:0 !important; padding:0 !important; margin:0 !important; }
      .pdf-page { width:${W}px; height:${H}px; box-sizing:border-box; padding:${MARGIN}px ${MARGIN}px ${MARGIN + MARKER_H}px ${MARGIN}px; position:relative; overflow:hidden; background:#fff; page-break-after:always; break-after:page; }
      .pdf-page:last-child { page-break-after:auto; break-after:auto; }
      .pdf-marker { position:absolute; bottom:${Math.round(MARGIN / 2)}px; inset-inline-end:${MARGIN}px; font:700 10px sans-serif; color:#112b3d; direction:ltr; }
      tr { break-inside:avoid; page-break-inside:avoid; }
    `;
    doc.head.appendChild(style);

    const allRows = Array.from(tbody.querySelectorAll<HTMLElement>(":scope > tr"));
    const bodyRows = allRows.filter((r) => !r.classList.contains("total-row"));
    const totalRows = allRows.filter((r) => r.classList.contains("total-row"));
    const srcBody = doc.body;
    const budget = H - MARGIN * 2 - MARKER_H;

    // Build one page: clone of the whole document body pruned around the table.
    const buildPage = (rows: HTMLElement[], first: boolean, last: boolean) => {
      const clone = srcBody.cloneNode(true) as HTMLElement;
      const t = clone.querySelector<HTMLElement>("table.data-table, table.report-table")!;
      const tb = t.querySelector("tbody")!;
      tb.innerHTML = "";
      rows.forEach((r) => tb.appendChild(r.cloneNode(true)));
      if (last) totalRows.forEach((r) => tb.appendChild(r.cloneNode(true)));
      pruneToPage(clone, t, { keepBefore: first, keepAfter: last });
      clone.querySelectorAll("script").forEach((s) => s.remove());
      const page = doc.createElement("div");
      page.className = "pdf-page";
      page.setAttribute("dir", opts.rtl ? "rtl" : "ltr");
      // move the pruned children of the clone into the page
      Array.from(clone.childNodes).forEach((n) => page.appendChild(n));
      return page;
    };

    const stage = doc.createElement("div");
    stage.style.cssText = `position:absolute;left:0;top:0;width:${W}px;visibility:hidden;`;
    doc.body.appendChild(stage);
    const fits = (page: HTMLElement) => {
      stage.innerHTML = "";
      const probe = page.cloneNode(true) as HTMLElement;
      probe.style.height = "auto";
      probe.style.overflow = "visible";
      stage.appendChild(probe);
      const inner = probe.getBoundingClientRect().height - MARGIN * 2 - MARKER_H;
      return inner <= budget;
    };

    // Greedy packing.
    const pages: HTMLElement[][] = [];
    let cursor = 0;
    while (cursor < bodyRows.length || pages.length === 0) {
      const first = pages.length === 0;
      let count = 0;
      let step = 8;
      // grow quickly, then refine
      while (cursor + count < bodyRows.length) {
        const candidate = bodyRows.slice(cursor, cursor + count + step);
        if (fits(buildPage(candidate, first, false))) count += step;
        else if (step > 1) step = Math.ceil(step / 2);
        else break;
      }
      if (count === 0 && cursor < bodyRows.length) count = 1; // a single oversized row still gets a page
      pages.push(bodyRows.slice(cursor, cursor + count));
      cursor += count;
      if (cursor >= bodyRows.length) break;
    }
    // Last page carries totals + signatures; spill rows to a new page if they do not fit.
    for (;;) {
      const lastRows = pages[pages.length - 1];
      const first = pages.length === 1;
      if (fits(buildPage(lastRows, first, true)) || lastRows.length <= 1) break;
      const moved = lastRows.pop()!;
      pages.push([moved]);
    }

    const total = pages.length;
    const built = pages.map((rows, i) => {
      const page = buildPage(rows, i === 0, i === total - 1);
      const marker = doc.createElement("div");
      marker.className = "pdf-marker";
      marker.textContent = `${opts.pageWord} ${i + 1} / ${total}`;
      page.appendChild(marker);
      return page;
    });

    // Replace the live body content with the built pages.
    doc.body.innerHTML = "";
    doc.body.appendChild(style);
    built.forEach((p) => doc.body.appendChild(p));
    iframe.style.height = `${H * total}px`;

    const html2pdfModule: any = await import("html2pdf.js");
    const html2pdf = html2pdfModule.default || html2pdfModule;
    await html2pdf()
      .set({
        margin: 0,
        filename: opts.filename,
        image: { type: "jpeg" as const, quality: 0.9 },
        html2canvas: { scale: 1.6, useCORS: true, logging: false, windowWidth: W, width: W },
        pagebreak: { mode: ["css"] },
        jsPDF: { orientation, unit: "mm" as const, format: "a4" as const, compress: true },
      })
      .from(doc.body)
      .save();
  } finally {
    iframe.remove();
  }
}
