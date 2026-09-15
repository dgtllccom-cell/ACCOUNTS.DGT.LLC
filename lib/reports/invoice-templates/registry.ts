/**
 * Invoice Template Registry — the ONE place that lists available visual
 * layouts. Adding Template 6 means adding one entry here + one renderer file;
 * nothing else in the engine (data assembly, the picker UI, default
 * resolution, the print pipe) needs to change.
 */

import type { InvoiceTemplateDefinition, InvoiceTemplateId } from "./types";
import { templateSupportsDocType } from "./types";
import { renderClassicInvoice } from "./classic";
import { renderModernInvoice } from "./modern";
import { renderProfessionalInvoice } from "./professional";
import { renderCompactInvoice } from "./compact";
import { renderPremiumInvoice } from "./premium";
import type { TradeDocType } from "@/lib/reports/trade-documents/types";

const mini = (rects: string, accent: string) =>
  `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="160" fill="#fff" stroke="#e2e8f0"/>${rects.replace(/\$A/g, accent)}</svg>`;

export const INVOICE_TEMPLATES: InvoiceTemplateDefinition[] = [
  {
    id: "classic",
    nameKey: "invtpl.template_classic",
    nameFallback: "Classic",
    descKey: "invtpl.desc_classic",
    descFallback: "Traditional bordered table layout",
    supports: "all",
    thumbnail: mini(
      `<rect x="8" y="8" width="104" height="18" fill="none" stroke="#0f172a" stroke-width="2"/>
       <rect x="8" y="30" width="50" height="24" fill="none" stroke="#94a3b8"/>
       <rect x="62" y="30" width="50" height="24" fill="none" stroke="#94a3b8"/>
       <rect x="8" y="60" width="104" height="10" fill="#0f172a"/>
       <rect x="8" y="72" width="104" height="8" fill="none" stroke="#cbd5e1"/>
       <rect x="8" y="82" width="104" height="8" fill="none" stroke="#cbd5e1"/>
       <rect x="8" y="94" width="104" height="10" fill="#e2e8f0"/>`,
      "#0f172a",
    ),
    render: renderClassicInvoice,
  },
  {
    id: "modern",
    nameKey: "invtpl.template_modern",
    nameFallback: "Modern",
    descKey: "invtpl.desc_modern",
    descFallback: "Clean sans-serif design with a single color accent",
    supports: "all",
    thumbnail: mini(
      `<rect x="0" y="0" width="120" height="5" fill="$A"/>
       <rect x="8" y="14" width="40" height="10" rx="3" fill="#0f172a"/>
       <rect x="70" y="12" width="42" height="14" rx="3" fill="$A" opacity="0.15"/>
       <rect x="8" y="34" width="50" height="20" rx="4" fill="#f1f5f9"/>
       <rect x="62" y="34" width="50" height="20" rx="4" fill="#f1f5f9"/>
       <rect x="8" y="62" width="104" height="9" rx="2" fill="$A"/>
       <rect x="8" y="74" width="104" height="7" fill="#f8fafc"/>
       <rect x="8" y="90" width="104" height="12" rx="4" fill="$A" opacity="0.85"/>`,
      "#4f46e5",
    ),
    render: renderModernInvoice,
  },
  {
    id: "professional",
    nameKey: "invtpl.template_professional",
    nameFallback: "Professional",
    descKey: "invtpl.desc_professional",
    descFallback: "Formal letterhead style with centered header",
    supports: "all",
    thumbnail: mini(
      `<rect x="30" y="8" width="60" height="6" fill="#1a1a1a"/>
       <rect x="8" y="18" width="104" height="2" fill="#1a1a1a"/>
       <rect x="40" y="26" width="40" height="8" fill="#1a1a1a"/>
       <rect x="8" y="40" width="50" height="20" fill="none" stroke="#999"/>
       <rect x="62" y="40" width="50" height="20" fill="none" stroke="#999"/>
       <rect x="8" y="66" width="104" height="9" fill="#f2f2f2" stroke="#1a1a1a"/>
       <rect x="8" y="78" width="104" height="7" fill="none" stroke="#ccc"/>
       <rect x="70" y="94" width="42" height="10" fill="none" stroke="#1a1a1a"/>`,
      "#1a1a1a",
    ),
    render: renderProfessionalInvoice,
  },
  {
    id: "compact",
    nameKey: "invtpl.template_compact",
    nameFallback: "Compact",
    descKey: "invtpl.desc_compact",
    descFallback: "Dense, minimal layout for short / single-line invoices",
    supports: "all",
    thumbnail: mini(
      `<rect x="24" y="8" width="72" height="98" fill="#fafafa" stroke="#d4d4d8"/>
       <rect x="28" y="12" width="30" height="6" fill="#18181b"/>
       <rect x="70" y="12" width="22" height="6" fill="#71717a"/>
       <rect x="28" y="24" width="64" height="4" fill="#a1a1aa"/>
       <rect x="28" y="34" width="64" height="3" fill="#e4e4e7"/>
       <rect x="28" y="40" width="64" height="3" fill="#e4e4e7"/>
       <rect x="28" y="50" width="64" height="1.5" fill="#18181b"/>
       <rect x="28" y="55" width="64" height="3" fill="#f4f4f5"/>
       <rect x="28" y="62" width="64" height="3" fill="#f4f4f5"/>
       <rect x="28" y="72" width="64" height="5" fill="#18181b" opacity="0.85"/>`,
      "#18181b",
    ),
    render: renderCompactInvoice,
  },
  {
    id: "premium",
    nameKey: "invtpl.template_premium",
    nameFallback: "Premium",
    descKey: "invtpl.desc_premium",
    descFallback: "Elaborate design with extra branding emphasis",
    supports: "all",
    thumbnail: mini(
      `<rect x="0" y="0" width="120" height="34" fill="#0b1120"/>
       <rect x="0" y="32" width="120" height="2" fill="#b8860b"/>
       <circle cx="18" cy="17" r="9" fill="#ffffff22"/>
       <rect x="66" y="10" width="46" height="14" fill="#b8860b" opacity="0.8"/>
       <rect x="8" y="42" width="50" height="22" rx="3" fill="none" stroke="#b8860b"/>
       <rect x="62" y="42" width="50" height="22" rx="3" fill="none" stroke="#0b1120"/>
       <rect x="8" y="70" width="104" height="9" fill="#0b1120"/>
       <rect x="8" y="82" width="104" height="7" fill="#f8fafc"/>
       <rect x="8" y="96" width="104" height="12" rx="4" fill="#fdf6e3" stroke="#b8860b"/>`,
      "#0b1120",
    ),
    render: renderPremiumInvoice,
  },
];

export function getInvoiceTemplate(id: string | null | undefined): InvoiceTemplateDefinition {
  return INVOICE_TEMPLATES.find((t) => t.id === id) || INVOICE_TEMPLATES[0];
}

export function listTemplatesForDocType(docType: TradeDocType): InvoiceTemplateDefinition[] {
  return INVOICE_TEMPLATES.filter((def) => templateSupportsDocType(def, docType));
}

export const DEFAULT_INVOICE_TEMPLATE_ID: InvoiceTemplateId = "classic";
