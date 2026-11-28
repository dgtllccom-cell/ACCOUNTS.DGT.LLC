import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));

import { SearchSelect, searchOptionDetails } from "@/components/ui/search-select";
import { HoverCellsArea } from "@/components/ui/hover-cells-area";
import { HOVER_TEXT_ATTR } from "@/lib/ui/use-cell-hover-titles";

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const manish = {
  value: "l-4", label: "ACC-000004 · Manish kumar · Dubai City Branch", keywords: "",
  details: "ACC-000004 · Manish kumar\nasset · AED\nDubai City Branch · United Arab Emirates Main Branch · United Arab Emirates\nDeira · Emirate of Dubai\nOsha 2 to Plaza Office number 106\nAED 2,000.00",
};

describe("ledger dropdown hover details", () => {
  it("hovering an account option shows its complete detail in a message bubble", () => {
    render(<SearchSelect label="" value="" options={[manish]} onValueChange={vi.fn()} optionHoverDetails />);
    fireEvent.click(screen.getByRole("button"));
    const option = screen.getByRole("option", { name: /Manish kumar/ });
    fireEvent.mouseEnter(option);
    const bubble = screen.getByRole("tooltip");
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toBe(manish.details);
    fireEvent.mouseLeave(option);
    expect(bubble.style.display).toBe("none");
  });

  it("without optionHoverDetails the dropdown behaves as before (no bubble)", () => {
    render(<SearchSelect label="" value="" options={[manish]} onValueChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.mouseEnter(screen.getByRole("option", { name: /Manish kumar/ }));
    const bubble = document.getElementById("erp-cell-hover-bubble");
    expect(!bubble || bubble.style.display === "none").toBe(true);
  });

  it("composes account-card details when no explicit detail is given", () => {
    expect(searchOptionDetails({ value: "x", label: "Purchase and sales Dubai office", primaryText: "Purchase and sales Dubai office", code: "ACC-000006",
      category: "income", branch: "Deira", city: "Dubai City Branch", country: "United Arab Emirates", phone: "+971 50 270 5588", status: "Active" }))
      .toBe("Purchase and sales Dubai office\nACC-000006\nincome\nDeira · Dubai City Branch · United Arab Emirates\n+971 50 270 5588");
  });
});

describe("ledger entries tables", () => {
  it("HoverCellsArea gives every entry cell its full data and shows it on hover", () => {
    render(
      <HoverCellsArea data-testid="area">
        <table>
          <thead><tr><th>Details</th><th>Debit (Dr)</th></tr></thead>
          <tbody><tr>
            <td data-testid="details">Sales Bill: DUBAI-0000 | Goods: WALNUT KENRELS | Qty: 200 Boxes | Amount: 2000</td>
            <td data-testid="debit">2,000.00</td>
          </tr></tbody>
        </table>
      </HoverCellsArea>
    );
    expect(screen.getByTestId("debit").getAttribute(HOVER_TEXT_ATTR)).toBe("2,000.00");
    fireEvent.mouseOver(screen.getByTestId("details"));
    expect(screen.getByRole("tooltip").textContent).toBe("Sales Bill: DUBAI-0000 | Goods: WALNUT KENRELS | Qty: 200 Boxes | Amount: 2000");
  });
});
