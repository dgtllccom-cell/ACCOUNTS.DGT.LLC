import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GoodsMasterRegistry } from "@/features/goods-master/components/goods-master-registry";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { formatGoodsCodeInput } from "@/lib/goods/code-input";
vi.stubGlobal("React", React);
vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/components/ui/universal-report-modal", () => ({ UniversalReportModal: () => null }));
vi.mock("@/features/goods-master/components/goods-hierarchy-tree", () => ({ GoodsHierarchyTree: () => null }));
async function openForm() {
  render(<GoodsMasterRegistry />);
  fireEvent.click(await screen.findByRole("button", { name: /New Goods Item/i }));
}
function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("e.g. ALMOND KERNELS / WALNUT IN SHELL"), { target: { value: "Walnuts" } });
  fireEvent.change(screen.getByPlaceholderText("0000-0000"), { target: { value: "08023200" } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiGet).mockImplementation(async (url) => url.includes("countries") ? { countries: [] } : url.includes("parameters") ? { parameters: [] } : { goods: [], summary: { total: 0, active: 0, inactive: 0 } });
});
afterEach(cleanup);
describe("Goods registry save feedback", () => {
  it("shows required-field errors inline without sending an empty record", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods & Unlock/i }));
    expect(screen.getByRole("alert").textContent).toContain("Enter Goods Name");
    expect(apiPost).not.toHaveBeenCalled();
  });
  it("shows the API error inline and leaves entered values available", async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error("Permission denied"));
    await openForm(); fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods & Unlock/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Permission denied");
    expect((screen.getByPlaceholderText("0000-0000") as HTMLInputElement).value).toBe("0802-3200");
  });
  it("keeps a successful record ID and updates it instead of creating again", async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ id: "saved-goods-id" });
    vi.mocked(apiPatch).mockResolvedValueOnce({});
    await openForm(); fillForm();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods & Unlock/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Goods saved successfully"));
    fireEvent.click(screen.getByRole("button", { name: /1. Main Goods/i }));
    fireEvent.click(screen.getByRole("button", { name: /Update Goods/i }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith("/api/erp/goods-master/saved-goods-id", expect.objectContaining({ chsCode: "0802-3200" })));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
  it("preserves leading zeroes, accepts pasted separators and does not truncate legacy codes", () => {
    expect(formatGoodsCodeInput("08023200")).toBe("0802-3200");
    expect(formatGoodsCodeInput("0802.3200")).toBe("0802-3200");
    expect(formatGoodsCodeInput("0802-320")).toBe("0802-320");
    expect(formatGoodsCodeInput("080232000000")).toBe("080232000000");
    expect(formatGoodsCodeInput("GOODS-0001")).toBe("GOODS-0001");
  });
});
