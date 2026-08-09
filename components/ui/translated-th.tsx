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
  const content = typeof children === "string" ? translateHeader(lang, children) : children;
  return <th {...props}>{content}</th>;
}
