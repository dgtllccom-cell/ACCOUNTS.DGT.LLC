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

    // Multi-section documents (several tables + cards, e.g. the Stock Balance journals) declare data-pdf-flow and are paginated block by block.
    if (doc.querySelector("[data-pdf-flow]")) {
      await renderFlowPages(doc, iframe, opts, W, H);
      return;
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
      .page-number { display:none !important; }
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

    // Rasterise each page inside the iframe (so the report's own stylesheet applies) and
    // assemble an A4 PDF.
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
    const pageW = orientation === "landscape" ? 297 : 210;
    const pageH = orientation === "landscape" ? 210 : 297;
    for (let i = 0; i < built.length; i += 1) {
      const canvas = await html2canvas(built[i], {
        scale: 1.6,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: W,
        height: H,
        windowWidth: W,
        windowHeight: H,
      });
      if (i > 0) pdf.addPage("a4", orientation);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, pageW, pageH);
    }
    pdf.save(opts.filename);
  } finally {
    iframe.remove();
  }
}


/**
 * Flow pagination for multi-section reports.
 *   <div data-pdf-flow>
 *     <section class="pdf-head">…letterhead (first page only; later pages get the small .pdf-runhead)…</section>
 *     <section class="pdf-block">…a card / panel (never split)…</section>
 *     <section class="pdf-block" data-splittable> <h2 class="block-title"> + <table> (rows may continue on the next page, header repeated) </section>
 *   </div>
 * Blocks are packed onto A4 pages greedily; "PAGE x / N" is stamped on every page; nothing is clipped or dropped.
 */
async function renderFlowPages(doc: Document, iframe: HTMLIFrameElement, opts: PaginatedPdfOptions, W: number, H: number) {
  const orientation = opts.orientation;
  const style = doc.createElement("style");
  style.textContent = `
    html, body { width:${W}px !important; margin:0 !important; padding:0 !important; background:#fff !important; overflow:visible !important; height:auto !important; }
    .no-print-toolbar, .custom-modal-overlay, .toolbar, .screen-only { display:none !important; }
    .pdf-page { width:${W}px; height:${H}px; box-sizing:border-box; padding:${MARGIN}px ${MARGIN}px ${MARGIN + MARKER_H}px ${MARGIN}px; position:relative; overflow:hidden; background:#fff; page-break-after:always; break-after:page; }
    .pdf-page:last-child { page-break-after:auto; break-after:auto; }
    .pdf-marker { position:absolute; bottom:${Math.round(MARGIN / 2)}px; inset-inline-end:${MARGIN}px; font:700 10px sans-serif; color:#112b3d; direction:ltr; }
    tr { break-inside:avoid; page-break-inside:avoid; }
    .pdf-runhead { display:flex !important; }
  `;
  doc.head.appendChild(style);

  const flow = doc.querySelector<HTMLElement>("[data-pdf-flow]")!;
  const head = flow.querySelector<HTMLElement>(".pdf-head");
  const runhead = flow.querySelector<HTMLElement>(".pdf-runhead");
  const blocks = Array.from(flow.querySelectorAll<HTMLElement>(":scope > .pdf-block"));
  const budget = H - MARGIN * 2 - MARKER_H;
  const mkPage = () => { const p = doc.createElement("div"); p.className = "pdf-page"; p.setAttribute("dir", opts.rtl ? "rtl" : "ltr"); return p; };

  const stage = doc.createElement("div");
  stage.style.cssText = `position:absolute;left:0;top:0;width:${W - MARGIN * 2}px;visibility:hidden;`;
  doc.body.appendChild(stage);
  const heightOf = (nodes: HTMLElement[]) => {
    stage.innerHTML = "";
    nodes.forEach((n) => stage.appendChild(n.cloneNode(true)));
    return stage.getBoundingClientRect().height;
  };

  // split one splittable block into row-chunks that each fit in `room` (title + thead repeat on every chunk)
  const chunksOf = (block: HTMLElement, fixed: HTMLElement[], room: number): HTMLElement[] => {
    const table = block.querySelector<HTMLElement>("table");
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return [block];
    const rows = Array.from(tbody.querySelectorAll<HTMLElement>(":scope > tr"));
    const body = rows.filter((r) => !r.classList.contains("total-row"));
    const totals = rows.filter((r) => r.classList.contains("total-row"));
    const make = (subset: HTMLElement[], withTotals: boolean) => {
      const c = block.cloneNode(true) as HTMLElement;
      const tb = c.querySelector("tbody")!;
      tb.innerHTML = "";
      subset.forEach((r) => tb.appendChild(r.cloneNode(true)));
      if (withTotals) totals.forEach((r) => tb.appendChild(r.cloneNode(true)));
      return c;
    };
    const out: HTMLElement[] = [];
    let cursor = 0;
    let avail = room;
    while (cursor < body.length) {
      let count = 0;
      for (let step = 16; step >= 1; step = Math.floor(step / 2) || (step === 1 ? 0 : 1)) {
        while (cursor + count < body.length && heightOf([...fixed, make(body.slice(cursor, cursor + count + step), false)]) <= avail) count += step;
        if (step === 1) break;
      }
      if (count === 0) count = 1;
      const last = cursor + count >= body.length;
      out.push(make(body.slice(cursor, cursor + count), last));
      cursor += count;
      avail = budget - heightOf(runhead ? [runhead] : []);
    }
    if (out.length === 0) out.push(make([], true));
    return out;
  };

  const pagesNodes: HTMLElement[][] = [[]];
  const used = () => pagesNodes[pagesNodes.length - 1];
  if (head) used().push(head);
  for (const block of blocks) {
    const fixed = used();
    const need = heightOf([...fixed, block]);
    if (need <= budget) { used().push(block); continue; }
    if (block.hasAttribute("data-splittable")) {
      const room = budget - heightOf(fixed);
      // not even the title + a few rows fit beside what is already on this page → continue on a fresh page
      const startNew = room < 120 && fixed.length > 0;
      if (startNew) { pagesNodes.push(runhead ? [runhead.cloneNode(true) as HTMLElement] : []); }
      const base = startNew ? (runhead ? [runhead] : []) : fixed;
      const chunks = chunksOf(block, base, budget - heightOf(base));
      chunks.forEach((c, i) => {
        if (i > 0) pagesNodes.push(runhead ? [runhead.cloneNode(true) as HTMLElement] : []);
        used().push(c);
      });
    } else {
      pagesNodes.push(runhead ? [runhead.cloneNode(true) as HTMLElement] : []);
      used().push(block);
    }
  }

  const total = pagesNodes.length;
  const built = pagesNodes.map((nodes, i) => {
    const page = mkPage();
    nodes.forEach((n) => page.appendChild(n.cloneNode(true)));
    if (i === 0) page.querySelectorAll(".pdf-runhead").forEach((n) => n.remove());
    const marker = doc.createElement("div");
    marker.className = "pdf-marker";
    marker.textContent = `${opts.pageWord} ${i + 1} / ${total}`;
    page.appendChild(marker);
    return page;
  });
  doc.body.innerHTML = "";
  doc.body.appendChild(style);
  built.forEach((p) => doc.body.appendChild(p));
  iframe.style.height = `${H * total}px`;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const pageW = orientation === "landscape" ? 297 : 210;
  const pageH = orientation === "landscape" ? 210 : 297;
  for (let i = 0; i < built.length; i += 1) {
    const canvas = await html2canvas(built[i], { scale: 1.4, useCORS: true, logging: false, backgroundColor: "#ffffff", width: W, height: H, windowWidth: W, windowHeight: H });
    if (i > 0) pdf.addPage("a4", orientation);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.8), "JPEG", 0, 0, pageW, pageH);
  }
  pdf.save(opts.filename);
}
