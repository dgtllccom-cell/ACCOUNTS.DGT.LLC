"use client";

/**
 * Clearing Truck Registration — View Report / Print / Download PDF.
 *
 * All three actions render the SAME A4 document: `buildTruckProfileConfig` → `buildMasterProfileReportHtml`
 * (the one canonical master-profile engine), so the preview, the printed page and the PDF are identical.
 *   - viewTruckReport     → opens the ERP A4 preview (printStore → PdfPreviewModal, which also offers Print / Download).
 *   - printTruckReport    → prints ONLY the report from a hidden iframe (no sidebar / ERP screen).
 *   - downloadTruckPdf    → A4 PDF rasterised from the same report HTML (html2pdf; section cards never split, "n / N" per page).
 */

import { buildMasterProfileReportHtml } from "@/lib/reports/open-master-profile-report-window";
import { printStore } from "@/lib/store/print-store";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import type { Lang } from "./shared";
import { buildTruckProfileConfig, type TruckProfileRecord } from "./build-truck-profile";

/** Same sanitising the preview modal applies: the engine's embedded auto-print script must never run. */
function stripAutoPrint(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => (/window\.print\s*\(|__ERP_A4_AUTOPRINT__/.test(block) ? "" : block));
}

const A4_PAGE_CSS = "<style>@page{size:A4 portrait;margin:6mm 6mm 11mm 6mm}@media print{html,body{margin:0!important;padding:0!important;background:#fff!important}.no-print-toolbar,.screen-only{display:none!important}}</style>";

export async function buildTruckReport(record: TruckProfileRecord, lang: Lang, scope: BrandingScope = {}) {
  const branding = await resolveDocumentBranding(scope, lang);
  const config = buildTruckProfileConfig(record, branding, lang);
  config.autoPrint = false;
  return { html: stripAutoPrint(buildMasterProfileReportHtml(config)), title: config.title };
}

export async function viewTruckReport(record: TruckProfileRecord, lang: Lang, scope?: BrandingScope): Promise<void> {
  const { html, title } = await buildTruckReport(record, lang, scope);
  printStore.openPrint(html, title, { lang });
}

export async function printTruckReport(record: TruckProfileRecord, lang: Lang, scope?: BrandingScope): Promise<void> {
  const { html, title } = await buildTruckReport(record, lang, scope);
  await new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", title);
    iframe.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:794px;height:1123px;border:0;visibility:hidden";
    iframe.srcdoc = html.includes("</head>") ? html.replace("</head>", `${A4_PAGE_CSS}</head>`) : A4_PAGE_CSS + html;
    iframe.onload = () => {
      // let fonts / the logo settle before the print dialog opens
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => { iframe.remove(); resolve(); }, 1500);
        }
      }, 500);
    };
    document.body.appendChild(iframe);
  });
}

/**
 * PDF of the SAME document. `renderPaginatedPdf` only knows table reports (it throws "no data table to paginate" for a
 * profile), so profile reports are rasterised straight from the report HTML: A4 portrait, section cards never split
 * (the engine's break-inside rules), "n / N" stamped on every page. Arabic / Urdu / Persian / Pashto shaping and RTL come
 * from the browser rendering, exactly as in the preview.
 */
export async function downloadTruckPdf(record: TruckProfileRecord, lang: Lang, scope?: BrandingScope): Promise<void> {
  const { html, title } = await buildTruckReport(record, lang, scope);
  const slug = (record.truckNumber || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const base = (title || "truck-registration").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "truck-registration";
  const filename = `${base}${slug ? `-${slug}` : ""}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const WIDTH = 794; // A4 @ 96dpi
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${WIDTH}px;height:1123px;border:0;visibility:hidden`;
  iframe.srcdoc = html.replace(/@media\s+print/gi, "@media all").replace("</head>", `<style>html,body{background:#fff!important}.no-print-toolbar,.screen-only,.screen-head,.screen-foot{display:none!important}</style></head>`);
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => { iframe.onload = () => resolve(); });
    const doc = iframe.contentDocument;
    if (!doc?.body) throw new Error("pdf iframe unavailable");
    try { await (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* ignore */ }
    await Promise.all(Array.from(doc.images).map((im) => (im.complete ? Promise.resolve() : new Promise<void>((r) => { im.onload = () => r(); im.onerror = () => r(); }))));
    const mod: any = await import("html2pdf.js");
    const html2pdf = mod.default || mod;
    await html2pdf()
      .set({
        margin: [6, 6, 11, 6],
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: WIDTH, backgroundColor: "#ffffff" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".section-card", ".overview-banner", ".footer-signatures", ".approval-box", ".info-table tr"] },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      })
      .from(doc.body)
      .toPdf()
      .get("pdf")
      .then((pdf: any) => {
        const n = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= n; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text(`${i} / ${n}`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 5, { align: "center" });
        }
      })
      .save();
  } finally {
    iframe.remove();
  }
}
