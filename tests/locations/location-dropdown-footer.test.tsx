import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchSelect } from "@/components/ui/search-select";

vi.stubGlobal("React", React);
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("shared location dropdown footer", () => {
  it.each(["Country", "State", "City"])("only shows New %s inside the opened dropdown, after the results", async (kind) => {
    const onCreate = vi.fn();
    render(<SearchSelect label={kind} value="" options={[{ value: "test-id", label: "Example (EX)" }]}
      createButtonPlacement="footer" createLabel={`New ${kind}`} onCreateNew={onCreate} onValueChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: `New ${kind}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: kind }));
    const dropdown = screen.getByRole("dialog");
    const result = within(dropdown).getByRole("option", { name: "Example (EX)" });
    const add = within(dropdown).getByRole("button", { name: `New ${kind}` });
    expect(result.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(within(dropdown).getByRole("combobox"), { target: { value: "no match" } });
    expect(within(dropdown).getByRole("button", { name: `New ${kind}` })).toBe(add);
    fireEvent.click(add);
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("does not show a create action without the caller's permission", () => {
    render(<SearchSelect label="City" value="" options={[]} createButtonPlacement="footer"
      createLabel="New City" onValueChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "City" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "New City" })).toBeNull();
  });
});
