import { describe, expect, it } from "vitest";
import { MM_TO_PX, paginateDocument, paginatedSheetCss, wantsPagination } from "@/lib/reports/print-paginate";
import { logicalColumnCount, removeActionColumns } from "@/lib/reports/print-dom-fragment";

/** jsdom has no layout: model heights from data-h (or 20px per row / 16px per text node). */
function fakeHeight(el: Element): number {
  const own = el.getAttribute("data-h");
  if (own) return Number(own);
  if (el.tagName === "TR") return 20;
  let sum = 0;
  el.childNodes.forEach((n) => {
    if (n.nodeType === 1) sum += fakeHeight(n as Element);
    else if ((n.textContent || "").trim()) sum += 16;
  });
  return sum;
}
function fakeWidth(el: Element): number {
  let max = 0;
  el.querySelectorAll("[data-w]").forEach((n) => { max = Math.max(max, Number(n.getAttribute("data-w"))); });
  return max;
}

function registryDoc(rows: number, opts: { cols?: number; tableWidth?: number; tfoot?: boolean } = {}) {
  const cols = opts.cols ?? 13;
  const head = Array.from({ length: cols }, (_, i) => `<th>COL ${i + 1}</th>`).join("");
  const body = Array.from({ length: rows }, (_, r) =>
    `<tr data-row="${r + 1}">${Array.from({ length: cols }, (_, c) => `<td>R${r + 1}C${c + 1}</td>`).join("")}</tr>`,
  ).join("");
  document.documentElement.innerHTML = `<head></head><body><div id="__frag">
    <div class="report" data-h-ignore>
      <h1 data-h="40">Account Master Registry</h1>
      <div class="kpis" data-h="60">KPIs</div>
      <div class="card">
        <table data-w="${opts.tableWidth ?? 900}">
          <thead><tr class="group"><th colspan="${cols}">GROUP</th></tr><tr class="leaf">${head}</tr></thead>
          <tbody>${body}</tbody>
          ${opts.tfoot ? `<tfoot><tr class="tot"><td colspan="${cols}">TOTAL</td></tr></tfoot>` : ""}
        </table>
      </div>
    </div>
  </div></body>`;
  return document;
}

const run = (doc: Document, orientation: "portrait" | "landscape" = "landscape") =>
  paginateDocument(doc, {
    orientation,
    rtl: false,
    pageLabel: (c, t) => `Page ${c} of ${t}`,
    measureHeight: (el) => fakeHeight(el),
    measureWidth: (el) => fakeWidth(el),
    stacksVertically: () => true,
  });

describe("print-paginate: real A4 sheets for the shared print preview", () => {
  it("splits a long registry (65 accounts) into several landscape sheets, all rows kept once", () => {
    const doc = registryDoc(65);
    const res = run(doc);
    // landscape content height ≈ (210 − 14 − 6) mm ≈ 718px → ~33 rows per sheet after the header
    expect(res.pageCount).toBeGreaterThan(1);
    const pages = Array.from(doc.querySelectorAll(".erp-pages > .erp-page"));
    expect(pages).toHaveLength(res.pageCount);
    const rows = Array.from(doc.querySelectorAll(".erp-page tbody tr[data-row]")).map((r) => Number(r.getAttribute("data-row")));
    expect(rows).toEqual(Array.from({ length: 65 }, (_, i) => i + 1));
  });

  it("repeats the full (two-row) table header on every sheet", () => {
    const doc = registryDoc(120);
    const res = run(doc);
    expect(res.pageCount).toBeGreaterThanOrEqual(3);
    doc.querySelectorAll(".erp-page").forEach((page) => {
      const thead = page.querySelector("table thead");
      expect(thead).not.toBeNull();
      expect(thead!.querySelectorAll("tr")).toHaveLength(2);
      expect(thead!.querySelector("tr.leaf th")!.textContent).toBe("COL 1");
    });
  });

  it("never overfills a sheet (no clipping) and stamps 'Page X of N' on each", () => {
    const doc = registryDoc(200);
    const res = run(doc);
    const budget = ((210 - 14 - 6) * MM_TO_PX) / res.scale;
    doc.querySelectorAll<HTMLElement>(".erp-page").forEach((page, i) => {
      const body = page.querySelector<HTMLElement>(".erp-page-body")!;
      expect(fakeHeight(body)).toBeLessThanOrEqual(budget + 0.5);
      expect(page.querySelector(".erp-page-footer")!.textContent).toBe(`Page ${i + 1} of ${res.pageCount}`);
    });
  });

  it("keeps the title and KPI band on the first sheet only", () => {
    const doc = registryDoc(90);
    run(doc);
    const pages = Array.from(doc.querySelectorAll(".erp-page"));
    expect(pages[0].querySelector("h1")?.textContent).toBe("Account Master Registry");
    pages.slice(1).forEach((p) => expect(p.querySelector("h1")).toBeNull());
  });

  it("re-opens the wrapping card on continuation sheets without duplicating ids", () => {
    const doc = registryDoc(90);
    run(doc);
    doc.querySelectorAll(".erp-page").forEach((p) => expect(p.querySelector(".card table")).not.toBeNull());
    expect(doc.querySelectorAll("#__frag").length).toBe(1);
  });

  it("fits a table wider than the paper to the page width (scale < 1, nothing clipped)", () => {
    const contentWidth = (297 - 14) * MM_TO_PX;
    const res = run(registryDoc(10, { tableWidth: 1700 }));
    expect(res.scale).toBeCloseTo(contentWidth / 1700, 2);
    const body = document.querySelector<HTMLElement>(".erp-page-body")!;
    expect(parseFloat(body.style.width) * res.scale).toBeCloseTo(contentWidth, 0);
    expect(body.style.transform).toContain("scale(");
  });

  it("does not scale a table that already fits", () => {
    const res = run(registryDoc(10, { tableWidth: 600 }));
    expect(res.scale).toBe(1);
  });

  it("short report → exactly one sheet", () => {
    const res = run(registryDoc(3));
    expect(res.pageCount).toBe(1);
  });

  it("keeps <tfoot> totals with the last rows, never alone", () => {
    const doc = registryDoc(150, { tfoot: true });
    run(doc);
    const pages = Array.from(doc.querySelectorAll(".erp-page"));
    const withFoot = pages.filter((p) => p.querySelector("tfoot"));
    expect(withFoot).toHaveLength(1);
    expect(withFoot[0]).toBe(pages[pages.length - 1]);
    expect(withFoot[0].querySelectorAll("tbody tr[data-row]").length).toBeGreaterThan(0);
  });

  it("emits A4 sheet CSS with page breaks for print", () => {
    const css = paginatedSheetCss("landscape", { rtl: true, scope: "#__frag" });
    expect(css).toContain("size: A4 landscape");
    expect(css).toContain("width:297mm");
    expect(css).toContain("break-after:page");
    expect(css).toContain("transform-origin:top right");
  });

  it("only documents that opt in are paginated", () => {
    expect(wantsPagination('<!doctype html><html lang="en" dir="ltr" data-erp-paginate="true">')).toBe(true);
    expect(wantsPagination("<!doctype html><html><body><div class=\"sheet\"></div>")).toBe(false);
  });
});

describe("print-dom-fragment: Actions column on a two-row header", () => {
  it("removes the right column (leaf ACTIONS) and narrows nothing else", () => {
    document.body.innerHTML = `<table><thead>
      <tr><th colspan="2">MASTER</th><th colspan="1">CONTACT</th><th>ACTIONS</th></tr>
      <tr><th>ACCOUNT NO.</th><th>NAME</th><th>CONTACTS</th><th>ACTIONS</th></tr></thead>
      <tbody><tr><td>A-1</td><td>Alpha</td><td>2</td><td><button>…</button></td></tr></tbody></table>`;
    const table = document.querySelector("table")!;
    expect(logicalColumnCount(table)).toBe(4);
    removeActionColumns(table);
    expect(logicalColumnCount(table)).toBe(3);
    expect(Array.from(table.rows[0].cells).map((c) => c.textContent)).toEqual(["MASTER", "CONTACT"]);
    expect(Array.from(table.rows[1].cells).map((c) => c.textContent)).toEqual(["ACCOUNT NO.", "NAME", "CONTACTS"]);
    expect(Array.from(table.rows[2].cells).map((c) => c.textContent)).toEqual(["A-1", "Alpha", "2"]);
  });

  it("narrows a spanning group cell that covers the Actions column", () => {
    document.body.innerHTML = `<table><thead>
      <tr><th colspan="2">CURRENCY &amp; STATUS / ACTIONS</th></tr>
      <tr><th>STATUS</th><th>Actions</th></tr></thead><tbody><tr><td>Active</td><td><a>edit</a></td></tr></tbody></table>`;
    const table = document.querySelector("table")!;
    removeActionColumns(table);
    expect(table.rows[0].cells[0].colSpan).toBe(1);
    expect(table.rows[2].cells).toHaveLength(1);
  });
});
