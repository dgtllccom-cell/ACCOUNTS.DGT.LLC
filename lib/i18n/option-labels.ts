import { t } from "@/lib/i18n/ui";
import { localizeUom } from "@/lib/i18n/uom";
import { translateValue } from "@/lib/i18n/table-values";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Canonical English enum value → dictionary key. Used for <option>/dropdown LABELS
 * across the Purchase / Sales / Local wizards. The stored / submitted `value` stays
 * the canonical English string (the wizards compare against it); only the visible
 * label follows the active language.
 *
 * Shared so every trade wizard translates the same enums identically — no per-file
 * copy of the map, no second translation system.
 */
export const OPTION_LABEL_KEYS: Record<string, string> = {
  // payment terms
  "Advance Payment": "purchase.opt_advance_payment",
  Invoice: "purchase.opt_invoice",
  "Final Payment": "purchase.opt_final_payment",
  Credit: "purchase.opt_credit",
  // shipping mode
  "By Sea": "purchase.opt_by_sea",
  "By Road": "purchase.opt_by_road",
  "By Air": "purchase.opt_by_air",
  // document / order status
  Draft: "purchase.opt_draft",
  Pending: "purchase.opt_pending",
  Confirmed: "purchase.opt_confirmed",
  Transferred: "purchase.opt_transferred",
  // container types
  "20 FT": "purchase.opt_container_20ft",
  "40 FT": "purchase.opt_container_40ft",
  "20 FT Reefer": "purchase.opt_container_20ft_reefer",
  "40 FT Reefer": "purchase.opt_container_40ft_reefer",
  "Reefer Container": "purchase.opt_container_reefer",
  "Non Reefer": "purchase.opt_container_non_reefer",
  "Open Top": "purchase.opt_container_open_top",
  "Flat Rack": "purchase.opt_container_flat_rack",
  "LCL / Bulk": "purchase.opt_container_lcl_bulk",
  // contact types (customer / party contacts store the canonical value)
  Mobile: "cbs.mobile_word",
  WhatsApp: "purchase.dd_whatsapp",
  Email: "purchase.dd_email",
  Landline: "whf.landline",
};

/** Translate a known enum value's label; unknown values (custom/user data) pass through. */
export function translateOptionLabel(lang: SupportedLanguage | string, value: string | null | undefined): string {
  const raw = (value ?? "").toString();
  if (!raw) return raw;
  const key = OPTION_LABEL_KEYS[raw];
  if (key) return t(lang as SupportedLanguage, key as never, raw);
  // a value saved as a label in Urdu / Pashto / Persian / Arabic ("موبائل فون"): the same approved term in the viewer's language
  if (/[؀-ۿ]/.test(raw)) {
    const term = translateValue(lang, raw);
    if (term !== raw) return term;
  }
  // fall back to the UOM localiser (Bags / Cartons / KG / Ton / …)
  return localizeUom(lang, raw);
}
