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
 * Language detection is delegated entirely to useActiveLanguage() — previously this
 * file had its own parallel useSyncExternalStore implementation, which risked two
 * independent module-level singletons (this one and use-active-language.ts's) drifting
 * out of sync after a hot reload. One shared store now backs every consumer.
 */

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };

export function Th({ children, ...props }: ThProps) {
  const lang = useActiveLanguage();
  const content = typeof children === "string" ? translateHeader(lang, children) : children;
  // key={lang} forces React to replace this text node outright when the language
  // changes, instead of diffing/patching it in place. Diffing is what should happen
  // here in theory, but the very first post-hydration language correction sometimes
  // leaves a handful of header cells stuck on the server's original English text —
  // a React reconciliation edge case tied to the hydration-mismatch recovery path,
  // not to translateHeader() (its return value is correct; the DOM update is what
  // gets dropped). Keying on lang sidesteps it reliably: a changed key always
  // unmounts + remounts, so there is nothing to (mis)diff.
  return <th {...props}><span key={lang}>{content}</span></th>;
}
