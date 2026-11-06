import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiGet: api.get, apiPost: api.post }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/components/ui/simple-modal", () => ({ SimpleModal: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/ui/search-select", () => ({ SearchSelect: (props: any) => <div>
  <output data-testid="selected-master">{props.value}</output>
  <button type="button" onClick={() => props.onCreateWithSearch ? props.onCreateWithSearch("New Registered Person") : props.onCreateNew()}>Create missing master</button>
</div> }));
vi.mock("@/features/customers/components/customer-form", () => ({ CustomerForm: (props: any) => <div>
  <span>{props.initialCustomerType}</span><span>{props.initialName}</span>
  <button type="button" onClick={() => props.onSave("new-person-id")}>Save person master</button>
</div> }));
vi.mock("@/features/companies/components/company-incorporation-form", () => ({ CompanyIncorporationForm: (props: any) => <div>
  <span>{props.showAccountLink ? "Account linkage shown" : "Transport master only"}</span>
  <button type="button" onClick={() => props.onSave({ id: "new-company-id", name: "Registered Transport" })}>Save company master</button>
</div> }));
beforeEach(() => {
  vi.stubGlobal("React", React);
  api.post.mockReset();
  api.get.mockReset().mockImplementation(async (url: string) => url.includes("/companies") ? { companies: [], company: null } : { customers: [], customer: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function TruckDraft({ role, company = false }: { role?: "Truck Owner / Transporter" | "Truck Driver"; company?: boolean }) {
  const [master, setMaster] = useState("");
  return <div><input aria-label="Truck number" defaultValue="PRESERVED-TRUCK-001" />
    {company ? <CompanyPicker label="Company" value={master} onValueChange={setMaster} transportContext allowEdit={false} /> :
      <PersonPicker label="Person" value={master} onValueChange={setMaster} personRole={role} countryId="pk" allowEdit={false} />}
  </div>;
}
describe("Truck Registration reuses the existing embedded masters", () => {
  it.each(["Truck Owner / Transporter", "Truck Driver"] as const)("opens the %s mode and auto-selects the saved person without clearing the truck", async (role) => {
    render(<TruckDraft role={role} />);
    fireEvent.click(screen.getByText("Create missing master"));
    expect(screen.getByText(role)).toBeTruthy();
    expect(screen.getByText("New Registered Person")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled(); // typing a name opens the full master form; it does not silently create a duplicate
    fireEvent.click(screen.getByText("Save person master"));
    await waitFor(() => expect(screen.getByTestId("selected-master").textContent).toBe("new-person-id"));
    expect((screen.getByLabelText("Truck number") as HTMLInputElement).value).toBe("PRESERVED-TRUCK-001");
  });
  it("opens the existing Company master without account linkage and selects the saved company", async () => {
    render(<TruckDraft company />);
    fireEvent.click(screen.getByText("Create missing master"));
    expect(screen.getByText("Transport master only")).toBeTruthy();
    fireEvent.click(screen.getByText("Save company master"));
    await waitFor(() => expect(screen.getByTestId("selected-master").textContent).toBe("new-company-id"));
    expect((screen.getByLabelText("Truck number") as HTMLInputElement).value).toBe("PRESERVED-TRUCK-001");
  });
});
