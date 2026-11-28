import React, { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { applyCellHoverTitles, cellHoverText, useCellHoverTitles, HOVER_TEXT_ATTR } from "@/lib/ui/use-cell-hover-titles";

const tip = (id: string) => screen.getByTestId(id).getAttribute(HOVER_TEXT_ATTR);

afterEach(cleanup);

function Registry() {
  const ref = useRef<HTMLTableElement | null>(null);
  useCellHoverTitles(ref);
  const [rows, setRows] = useState([{ no: "ACC-000010", name: "Haji abdullah chaman", branch: "Dubai City Branch", by: "By: Super Admin (Global Group)" }]);
  return (
    <>
      <button type="button" onClick={() => setRows([{ no: "ACC-000174", name: "حاجی نجیب اللہ برنس خریداری اکاونٹ کوئٹہ", branch: "Quetta City Branch", by: "By: NAJEEBULLAH ABDULLAH" }])}>swap</button>
      <table ref={ref}>
        <thead><tr><th>Account No.</th><th>Account Name</th><th>Branch</th><th>Actions</th><th>Skip</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no}>
              <td data-testid="no"><span>{r.no}</span></td>
              <td data-testid="name"><p className="truncate">{r.name}</p></td>
              <td data-testid="branch"><div>{r.branch}</div>{"\n"}<div>{r.by}</div></td>
              <td data-testid="actions"><button type="button" aria-label="menu" /></td>
              <td data-testid="skip" data-no-hover-title>x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

describe("account table hover titles", () => {
  it("shows each cell's full data on hover and refreshes after the rows change", async () => {
    render(<Registry />);
    expect(tip("no")).toBe("ACC-000010");
    expect(tip("name")).toBe("Haji abdullah chaman");
    expect(tip("branch")).toBe("Dubai City Branch\nBy: Super Admin (Global Group)");
    expect(tip("actions")).toBeNull(); // icon-only action cell: no bubble
    expect(tip("skip")).toBeNull(); // opted out
    expect(screen.getByText("Account No.").hasAttribute(HOVER_TEXT_ATTR)).toBe(false); // header cells untouched

    // hovering a cell shows the message bubble with that cell's full data; leaving the table hides it
    fireEvent.mouseOver(screen.getByText("Haji abdullah chaman"));
    const bubble = screen.getByRole("tooltip");
    expect(bubble.textContent).toBe("Haji abdullah chaman");
    expect(bubble.style.display).toBe("block");
    fireEvent.mouseOver(screen.getByTestId("branch"));
    expect(bubble.textContent).toBe("Dubai City Branch\nBy: Super Admin (Global Group)");
    fireEvent.mouseOut(screen.getByTestId("branch"), { relatedTarget: document.body });
    expect(bubble.style.display).toBe("none");

    await act(async () => { fireEvent.click(screen.getByText("swap")); });
    await waitFor(() => expect(tip("no")).toBe("ACC-000174"));
    expect(tip("name")).toBe("حاجی نجیب اللہ برنس خریداری اکاونٹ کوئٹہ");
    expect(tip("branch")).toBe("Quetta City Branch\nBy: NAJEEBULLAH ABDULLAH");
  });

  it("ignores hidden popovers and keeps label + value on one line", () => {
    const table = document.createElement("table");
    table.innerHTML = '<tbody><tr><td><div>Quetta City Branch</div>\n<div>By:</div>\n<div>NAJEEBULLAH ABDULLAH</div><div class="opacity-0">ACCOUNT DETAILS View Details</div></td></tr></tbody>';
    applyCellHoverTitles(table);
    expect(table.querySelector("td")!.getAttribute(HOVER_TEXT_ATTR)).toBe("Quetta City Branch\nBy: NAJEEBULLAH ABDULLAH");
  });

  it("collapses whitespace and skips empty cells", () => {
    const table = document.createElement("table");
    table.innerHTML = "<tbody><tr><td>  Purchases   &amp;  Sales \n\n  P/S  </td><td> </td></tr></tbody>";
    applyCellHoverTitles(table);
    const [a, b] = Array.from(table.querySelectorAll("td"));
    expect(a.getAttribute(HOVER_TEXT_ATTR)).toBe("Purchases & Sales\nP/S");
    expect(b.hasAttribute(HOVER_TEXT_ATTR)).toBe(false);
    expect(cellHoverText(a)).toBe("Purchases & Sales\nP/S");
  });
});
