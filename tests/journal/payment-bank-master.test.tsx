import React, { useState } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransferDetailsSection } from "@/features/roznamcha/components/transfer-details-section";
const mocks = vi.hoisted(() => ({ get: vi.fn(), modes: vi.fn(), record: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiGet: mocks.get, apiPost: mocks.post, apiPut: vi.fn() }));
vi.mock("@/features/settings/transfer-mode-api", () => ({ listTransferModes: mocks.modes, createTransferMode: vi.fn(), updateTransferMode: vi.fn() }));
const bank = { id: "11111111-1111-4111-8111-111111111111", bank_name: "Saved Test Bank", country_id: "PK", is_active: true };
beforeEach(() => { vi.stubGlobal("React", React); vi.clearAllMocks(); mocks.get.mockResolvedValue({ banks: [bank] }); mocks.modes.mockResolvedValue([{ id: "M1", name: "Cheque", reference_label: "Approved cheque number", reference_placeholder: "Cheque reference", is_active: true }]); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Form() {
  const [name, setName] = useState(""), [mode, setMode] = useState(""), [ref, setRef] = useState("");
  return <TransferDetailsSection bankName={name} onBankNameChange={setName} onBankRecordChange={mocks.record} transferMode={mode} onTransferModeChange={setMode} transactionReference={ref} onTransactionReferenceChange={setRef} countryId="PK" lang="en" />;
}
it("uses scoped Settings masters and retains the selected bank UUID without an IBAN or book-number field", async () => {
  render(<Form />);
  fireEvent.click(await screen.findByRole("button", { name: "Select bank" }));
  fireEvent.click(screen.getByRole("button", { name: "Saved Test Bank" }));
  expect(mocks.get).toHaveBeenCalledWith("/api/erp/banks?limit=500&status=Active&countryId=PK");
  expect(mocks.record).toHaveBeenCalledWith(bank);
  fireEvent.click(await screen.findByRole("button", { name: "Select mode" }));
  fireEvent.click(screen.getByRole("button", { name: "Cheque" }));
  expect(screen.getByText("Approved cheque number *")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "CHQ-100" } });
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("CHQ-100");
  expect(screen.queryByText(/IBAN|BRM|Bank Account/i)).toBeNull();
  expect(mocks.post).not.toHaveBeenCalled();
});
