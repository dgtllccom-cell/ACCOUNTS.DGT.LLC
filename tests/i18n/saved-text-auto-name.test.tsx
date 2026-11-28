import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SavedText } from "@/components/i18n/saved-text";
import { localizeName } from "@/lib/i18n/transliteration";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("SavedText kind=name — automatic name conversion, marked", () => {
  it.each([
    ["ur", "Manish kumar", "منیش کمار", "خودکار"],
    ["ar", "Manish kumar", "منيش كومار", "تلقائي"],
    ["fa", "Manish kumar", "منیش کومار", "خودکار"],
    ["ps", "Manish kumar", "منیش کمار", "اتومات"],
    ["en", "نصراللہ استاد", "Nasrullah Ustad", "auto"],
  ] as const)("%s viewer sees %s converted, with a translated 'auto' chip and the saved name in the title", (lang, saved, shown, chip) => {
    const { container } = render(<SavedText value={saved} lang={lang} kind="name" />);
    const el = container.querySelector('[data-auto-name="true"]')!;
    expect(el.textContent).toBe(shown);
    expect(el.getAttribute("data-saved-name")).toBe(saved);
    expect(el.getAttribute("title")).toContain(saved);
    expect(el.querySelector("[data-chip]")!.getAttribute("data-chip")).toBe(chip);
  });

  it("an already converted value (localizeName first) is still marked auto", () => {
    const { container } = render(<SavedText value={localizeName("Kamal Waqas", "ur")} lang="ur" kind="name" />);
    expect(container.querySelector('[data-auto-name="true"]')!.getAttribute("data-saved-name")).toBe("Kamal Waqas");
  });

  it("a name in the viewer's own script is shown plainly; free text keeps the language chip", () => {
    render(<SavedText value="Manish kumar" lang="en" kind="name" />);
    expect(screen.getByText("Manish kumar").closest("[data-auto-name]")).toBeNull();
    const { container } = render(<SavedText value="Some English note" lang="ur" kind="text" />);
    expect(container.querySelector('[data-translation-pending="true"]')).not.toBeNull();
  });
});
