import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlobalHoverDetails, hoverDetailsTarget } from "@/components/ui/global-hover-details";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const bubble = () => document.getElementById("erp-cell-hover-bubble");

function AnyErpTable() {
  return (
    <div>
      <GlobalHoverDetails />
      <table>
        <thead><tr><th>Account Name</th><th>Qty</th><th>Rate</th><th>Actions</th></tr></thead>
        <tbody>
          <tr>
            <td data-testid="name"><a href="#a">Purchase and sales Dubai office</a></td>
            <td data-testid="qty"><input aria-label="qty" defaultValue="200" /></td>
            <td data-testid="rate"><select aria-label="unit"><option>BAGS</option><option>CARTONS</option></select></td>
            <td data-testid="act"><button type="button" aria-label="more" /></td>
          </tr>
        </tbody>
      </table>
      <div dir="rtl">
        <table>
          <tbody><tr><td data-testid="ur">حاجی نجیب اللہ برنس خریداری اکاونٹ کوئٹہ</td></tr></tbody>
        </table>
      </div>
      <div data-hover-owned=""><table><tbody><tr><td data-testid="owned">owned</td></tr></tbody></table></div>
      <span data-testid="cut" className="truncate">Najeebullah Abdullah Trading Company Quetta</span>
    </div>
  );
}

describe("ERP-wide hover details (root layout)", () => {
  it("any table cell anywhere shows its full data; leaving hides it", () => {
    render(<AnyErpTable />);
    fireEvent.mouseOver(screen.getByText("Purchase and sales Dubai office"));
    expect(bubble()!.style.display).toBe("block");
    expect(bubble()!.textContent).toBe("Purchase and sales Dubai office");
    fireEvent.mouseOut(screen.getByTestId("name"), { relatedTarget: document.body });
    expect(bubble()!.style.display).toBe("none");
  });

  it("works in RTL tables and keeps Urdu text exactly as rendered", () => {
    render(<AnyErpTable />);
    fireEvent.mouseOver(screen.getByTestId("ur"));
    expect(bubble()!.textContent).toBe("حاجی نجیب اللہ برنس خریداری اکاونٹ کوئٹہ");
    expect(bubble()!.getAttribute("dir")).toBe("auto");
  });

  it("skips editable cells, icon-only cells and areas that run their own bubble", () => {
    render(<AnyErpTable />);
    expect(hoverDetailsTarget(screen.getByTestId("qty"))).toBeNull();
    expect(hoverDetailsTarget(screen.getByTestId("rate"))).toBeNull(); // would otherwise list every option
    expect(hoverDetailsTarget(screen.getByTestId("act"))).toBeNull();
    expect(hoverDetailsTarget(screen.getByTestId("owned"))).toBeNull();
  });

  it("a cut-off name outside a table shows its full text only when it is actually truncated", () => {
    render(<AnyErpTable />);
    const cut = screen.getByTestId("cut");
    expect(hoverDetailsTarget(cut)).toBeNull(); // jsdom: no overflow
    Object.defineProperty(cut, "scrollWidth", { configurable: true, value: 400 });
    Object.defineProperty(cut, "clientWidth", { configurable: true, value: 120 });
    expect(hoverDetailsTarget(cut)?.text).toBe("Najeebullah Abdullah Trading Company Quetta");
  });
});
