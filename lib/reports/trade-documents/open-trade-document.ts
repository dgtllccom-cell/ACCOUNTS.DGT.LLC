/**
 * Client-side opener for the trade-document engine. Kept in its own module so the
 * pure `buildTradeDocumentHtml` builder (build-trade-document.ts) stays free of
 * the client-only print store and can be imported from server code (e.g. the
 * Business Edit Invoice API routes).
 */

import { t } from "@/lib/i18n/ui";
import { printStore } from "@/lib/store/print-store";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { buildTradeDocumentHtml, docTitleKeyFor } from "./build-trade-document";
import type { TradeDocumentInput } from "./types";

export function openTradeDocument(input: TradeDocumentInput): void {
  if (typeof window === "undefined") return;
  const [titleKey, titleFb] = docTitleKeyFor(input);
  const title = t((input.lang || "en") as SupportedLanguage, titleKey as never, titleFb);
  printStore.openPrint(buildTradeDocumentHtml(input), `${title} — ${input.docNo}`, {
    lang: input.lang || "en",
    // in-preview language / orientation switch rebuilds from the same source input
    rebuild: ({ lang, orientation }) =>
      buildTradeDocumentHtml({ ...input, lang: lang as SupportedLanguage, orientation }),
  });
}
