"use client";

import { printStore } from "@/lib/store/print-store";

/**
 * Safe replacement for the `document.body.innerHTML = fragment; window.print();
 * … ; window.location.reload()` anti-pattern.
 *
 * Takes the innerHTML of an already-rendered voucher / A4 block, wraps it in a
 * minimal self-contained A4 document and hands it to the shared `PdfPreviewModal`
 * (iframe — no body swap, no reload, and the modal's Print / Save-as-PDF /
 * orientation / Email / WhatsApp actions all work).
 */
export function printDomFragmentViaModal(
  elementId: string,
  title: string,
  opts: { lang?: string; orientation?: "portrait" | "landscape" } = {},
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(elementId);
  const inner = el?.innerHTML;
  if (!inner) return false;

  const lang = opts.lang || (typeof document !== "undefined" ? document.documentElement.lang : "en") || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const orientation = opts.orientation || "portrait";

  // Pull the page's stylesheets so Tailwind utility classes on the voucher still
  // resolve inside the iframe.
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${title.replace(/[<>&"]/g, "")}</title>
${styleLinks}
<style>
  @page { size: A4 ${orientation}; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print, .no-print-toolbar { display: none !important; }
  #__frag { padding: 8mm; }
  @media print { #__frag { padding: 0; } }
</style>
</head>
<body><div id="__frag">${inner}</div></body>
</html>`;

  printStore.openPrint(html, title);
  return true;
}
