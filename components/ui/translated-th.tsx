"use client";

import type { ReactNode, ThHTMLAttributes } from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

/**
 * <Th> — a drop-in replacement for <th> that translates its header text into the
 * active language. Used everywhere table headers appear so column headings follow
 * the language selector automatically.
 *
 * Why a component (not a hook per table): there are 100+ table components. Swapping
 * `<th>` → `<Th>` is a safe, mechanical change, and because translateHeader() returns
 * unknown/`en` labels unchanged, wrapping every <th> (including data cells) is harmless.
 *
 * useActiveLanguage() is SSR-safe on its own (getServerSnapshot returns "en", matching
 * what the server renders), so no extra mount-gating is needed here.
 */

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };

export function Th({ children, ...props }: ThProps) {
  const lang = useActiveLanguage();
  // plain text children are translated; so are the text pieces of mixed children such as [label, <span>↕</span>]
  const translateNode = (node: ReactNode): ReactNode =>
    typeof node === "string" ? translateHeader(lang, node) : Array.isArray(node) ? node.map((n, i) => (typeof n === "string" ? translateHeader(lang, n) : n)) : node;
  const content = translateNode(children);
  return <th {...props}>{content}</th>;
}
