"use client";

import { printStore } from "@/lib/store/print-store";
import { barcodeSvgMarkup } from "@/components/ui/barcode";
import { qrCodeSvgMarkup } from "@/components/ui/qr-code";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type BarcodeLabelItem = {
  code: string; // the barcode value
  name: string; // product / goods name
  reference?: string; // CHS / product code
  type?: "CODE128" | "EAN13" | "UPC" | "QR";
  copies?: number;
};

const RTL: SupportedLanguage[] = ["ur", "ar", "fa", "ps"];

/**
 * Opens an A4 sheet of scannable barcode / QR labels in the shared print preview.
 * Pure SVG — no external library, CSP-safe. 3 columns × N rows.
 */
export function openBarcodeLabelPrint(items: BarcodeLabelItem[], opts?: { lang?: SupportedLanguage; title?: string }) {
  const lang = (opts?.lang ?? "en") as SupportedLanguage;
  const dir = RTL.includes(lang) ? "rtl" : "ltr";
  const heading = opts?.title || t(lang, "prodm.barcode_labels" as never, "Barcode Labels");

  const labels: string[] = [];
  for (const it of items) {
    const svg = (it.type ?? "CODE128") === "QR" ? qrCodeSvgMarkup(it.code, { size: 110 }) : barcodeSvgMarkup(it.code, { height: 48, moduleWidth: 1.5 });
    if (!svg) continue;
    for (let i = 0; i < Math.max(1, it.copies ?? 1); i++) {
      labels.push(`
        <div class="label">
          <div class="lname">${escapeHtml(it.name)}</div>
          ${it.reference ? `<div class="lref">${escapeHtml(it.reference)}</div>` : ""}
          <div class="lbar">${svg}</div>
        </div>`);
    }
  }

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, 'Noto Naskh Arabic', sans-serif; margin: 0; color: #111; }
    h1 { font-size: 13pt; margin: 0 0 8mm; }
    .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .label { border: 1px solid #cbd5e1; border-radius: 4px; padding: 3mm; text-align: center; break-inside: avoid; background: #fff; }
    .lname { font-size: 8.5pt; font-weight: 700; line-height: 1.15; min-height: 2.4em; overflow: hidden; }
    .lref { font-size: 7pt; color: #475569; font-family: 'Courier New', monospace; margin-top: 1mm; }
    .lbar { margin-top: 2mm; display: flex; justify-content: center; }
    .lbar svg { max-width: 100%; height: auto; }
    @media print { .label { border-color: #94a3b8; } }
  </style></head><body>
    <h1>${escapeHtml(heading)}</h1>
    <div class="sheet">${labels.join("")}</div>
  </body></html>`;

  printStore.openPrint(html, heading, { lang });
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
}
