import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent, getByRole } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supportedLanguages } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { PreferencesControls } from "@/components/layout/preferences-controls";
import { DashboardTools } from "@/components/layout/dashboard-tools";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/components/layout/quick-preferences-popover", () => ({
  QuickPreferencesPopover: () => <button type="button">Settings stub</button>
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
function render(children: React.ReactNode) {
  const container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container); act(() => root?.render(children)); return container;
}
beforeEach(() => {
  refresh.mockClear(); localStorage.clear(); document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.cookie = "erp_lang=; Path=/; Max-Age=0";
  act(() => window.dispatchEvent(new Event("erp_language_changed")));
});
afterEach(() => {
  if (root) act(() => root?.unmount()); root = undefined; document.body.replaceChildren();
});

describe("compact dashboard language control", () => {
  it("offers all five languages by their native names", () => {
    const container = render(<PreferencesControls />);
    const select = getByRole(container, "combobox", { name: t("en", "nav.language") }) as HTMLSelectElement;
    expect(Array.from(select.options).map(o => o.value)).toEqual(supportedLanguages.map(l => l.code));
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(supportedLanguages.map(l => l.nativeName));
  });
  it("keeps selection, HTML direction, local storage and server cookie in sync across every language", () => {
    const container = render(<PreferencesControls />);
    const select = container.querySelector("select")!;
    for (const language of ["ur", "ps", "fa", "ar", "en"] as const) {
      act(() => fireEvent.change(select, { target: { value: language } }));
      expect(select.value).toBe(language);
      expect(document.documentElement.lang.split("-")[0]).toBe(language);
      expect(document.documentElement.dir).toBe(language === "en" ? "ltr" : "rtl");
      expect(localStorage.getItem("erp_lang")).toBe(language);
      expect(document.cookie).toContain(`erp_lang=${language}`);
      expect(select.getAttribute("aria-label")).toBe(t(language, "nav.language"));
    }
    expect(refresh).toHaveBeenCalledTimes(5);
  });
  it("reconciles a saved language with a stale English document and follows changes from another tab", () => {
    localStorage.setItem("erp_lang", "ur");
    act(() => window.dispatchEvent(new Event("erp_language_changed")));
    const container = render(<PreferencesControls />);
    expect(container.querySelector("select")?.value).toBe("ur");
    expect(document.documentElement.dir).toBe("rtl");
    act(() => {
      localStorage.setItem("erp_lang", "fa");
      window.dispatchEvent(new StorageEvent("storage", { key: "erp_lang", newValue: "fa" }));
    });
    expect(container.querySelector("select")?.value).toBe("fa");
    expect(document.documentElement.lang).toBe("fa");
  });
});

describe("mobile tool overflow", () => {
  it("keeps one mounted tool, closes on Escape and restores keyboard focus", () => {
    const container = render(<DashboardTools><button>Calculator stub</button></DashboardTools>);
    const trigger = getByRole(container, "button", { name: t("en", "common.actions") });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    act(() => fireEvent.click(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => fireEvent.keyDown(document, { key: "Escape" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelectorAll(".erp-topbar-tools-content button")).toHaveLength(1);
  });
  it("closes when tapping outside the tools", () => {
    const container = render(<DashboardTools><button>Tool stub</button></DashboardTools>);
    const trigger = getByRole(container, "button", { name: t("en", "common.actions") });
    act(() => fireEvent.click(trigger));
    act(() => fireEvent.pointerDown(document.body));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
