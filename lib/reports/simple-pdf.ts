/**
 * simple-pdf — a tiny, dependency-free PDF table writer for server-side report
 * downloads that must produce a REAL `application/pdf` file (not an HTML page
 * with a Print button) and must always reflect current data.
 *
 * Scope on purpose: one landscape A4 table, the 14 WinAnsi core fonts
 * (Helvetica — no embedding), automatic page breaks, a repeating header row and
 * "Page X of Y". For rich multi-language / RTL report layouts keep using the
 * client Universal Print + html2pdf path; this is for plain admin registers.
 */

type Align = "left" | "right" | "center";
export interface PdfColumn {
  header: string;
  /** row -> cell text */
  value: (row: Record<string, unknown>, index: number) => string;
  /** relative width weight (default 1) */
  width?: number;
  align?: Align;
}

export interface SimplePdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Array<Record<string, unknown>>;
  /** footer note under the table on the last page */
  note?: string;
  generatedAt?: Date;
}

// ── WinAnsi escaping + width metrics (Helvetica AFM, 1000-unit em) ──
const HELV_WIDTHS: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191, 40: 333, 41: 333,
  42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278, 48: 556, 49: 556, 50: 556, 51: 556,
  52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584,
  62: 584, 63: 556, 64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778,
  82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611, 91: 278,
  92: 278, 93: 278, 94: 469, 95: 556, 96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556,
  102: 278, 103: 556, 104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
  111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
  120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584,
};
const HELVB_WIDTHS: Record<number, number> = {
  ...HELV_WIDTHS,
  65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 77: 833, 79: 778,
  81: 778, 82: 722, 87: 1000, 97: 556, 98: 611, 99: 556, 100: 611, 101: 611, 103: 611, 104: 611,
  109: 889, 110: 611, 111: 611, 112: 611, 113: 611, 115: 556, 117: 611, 119: 778,
};

function toWinAnsi(s: string): string {
  // keep printable ASCII; replace anything else with '?' so metrics stay sane
  return (s ?? "").replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E]/g, (c) => {
    const map: Record<string, string> = { "–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "•": "-", "…": "..." };
    return map[c] ?? "?";
  });
}
function escPdf(s: string): string {
  return s.replace(/([\\()])/g, "\\$1");
}
function textWidth(s: string, size: number, bold = false): number {
  const t = HELVB_WIDTHS;
  const n = HELV_WIDTHS;
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    w += (bold ? t[code] : n[code]) ?? 556;
  }
  return (w / 1000) * size;
}
function ellipsize(s: string, maxWidth: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && textWidth(out + "...", size, bold) > maxWidth) out = out.slice(0, -1);
  return out + "...";
}

export function buildSimpleTablePdf(opts: SimplePdfOptions): Buffer {
  const PAGE_W = 842; // A4 landscape pt
  const PAGE_H = 595;
  const M = 36;
  const contentW = PAGE_W - M * 2;
  const generatedAt = opts.generatedAt ?? new Date();

  const cols = opts.columns;
  const weightSum = cols.reduce((a, c) => a + (c.width ?? 1), 0);
  const colW = cols.map((c) => ((c.width ?? 1) / weightSum) * contentW);

  const FS_TITLE = 15;
  const FS_SUB = 9;
  const FS_HEAD = 8;
  const FS_CELL = 8;
  const ROW_H = 15;
  const HEAD_H = 18;

  const topBlock = M + FS_TITLE + (opts.subtitle ? FS_SUB + 6 : 0) + 14;
  const bottomLimit = PAGE_H - M - 16; // room for page footer

  type Op = string;
  const pages: Op[][] = [];
  let cur: Op[] = [];
  let y = 0;

  const drawText = (x: number, yy: number, text: string, size: number, bold: boolean, align: Align, w: number) => {
    const t = toWinAnsi(text);
    const tw = textWidth(t, size, bold);
    let tx = x;
    if (align === "right") tx = x + w - tw;
    else if (align === "center") tx = x + (w - tw) / 2;
    cur.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${tx.toFixed(2)} ${(PAGE_H - yy).toFixed(2)} Td (${escPdf(t)}) Tj ET`);
  };
  const hline = (yy: number) => cur.push(`0.6 w 0.75 0.79 0.85 RG ${M} ${(PAGE_H - yy).toFixed(2)} m ${PAGE_W - M} ${(PAGE_H - yy).toFixed(2)} l S`);

  const startPage = () => {
    cur = [];
    y = topBlock;
    drawText(M, M + FS_TITLE, opts.title, FS_TITLE, true, "left", contentW);
    if (opts.subtitle) drawText(M, M + FS_TITLE + FS_SUB + 4, opts.subtitle, FS_SUB, false, "left", contentW);
    // header row
    cur.push(`0.93 0.95 0.97 rg ${M} ${(PAGE_H - y - HEAD_H).toFixed(2)} ${contentW.toFixed(2)} ${HEAD_H} re f`);
    let x = M;
    cols.forEach((c, i) => {
      drawText(x + 4, y + HEAD_H - 6, ellipsize(toWinAnsi(c.header).toUpperCase(), colW[i] - 8, FS_HEAD, true), FS_HEAD, true, c.align ?? "left", colW[i] - 8);
      x += colW[i];
    });
    y += HEAD_H;
    hline(y);
  };

  startPage();
  opts.rows.forEach((row, idx) => {
    if (y + ROW_H > bottomLimit) {
      pages.push(cur);
      startPage();
    }
    let x = M;
    cols.forEach((c, i) => {
      const raw = toWinAnsi(c.value(row, idx));
      drawText(x + 4, y + ROW_H - 5, ellipsize(raw, colW[i] - 8, FS_CELL, false), FS_CELL, false, c.align ?? "left", colW[i] - 8);
      x += colW[i];
    });
    y += ROW_H;
    hline(y);
  });
  if (opts.note) {
    y += 12;
    drawText(M, y, toWinAnsi(opts.note), 7.5, false, "left", contentW);
  }
  pages.push(cur);

  // page footers
  const stamp = `Generated ${generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`;
  pages.forEach((p, i) => {
    const footer = `${stamp}    |    Page ${i + 1} of ${pages.length}`;
    const fw = textWidth(footer, 7, false);
    p.push(`BT /F1 7 Tf ${(PAGE_W - M - fw).toFixed(2)} ${(M - 10).toFixed(2)} Td (${escPdf(footer)}) Tj ET`);
    p.push(`BT /F1 7 Tf ${M} ${(M - 10).toFixed(2)} Td (${escPdf(toWinAnsi(opts.title))}) Tj ET`);
  });

  // ── assemble PDF objects ──
  const objs: string[] = [];

  const catalogId = 1;
  const pagesId = 2;
  const fontF1Id = 3;
  const fontF2Id = 4;
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[fontF1Id - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objs[fontF2Id - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const pageObjIds: number[] = [];
  let nextId = 5;
  const contentIds: number[] = [];
  pages.forEach((p) => {
    const stream = p.join("\n");
    const contentId = nextId++;
    objs[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
    contentIds.push(contentId);
    const pageId = nextId++;
    pageObjIds.push(pageId);
    objs[pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
