import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomerAssignedCountry } from "@/features/customers/components/customer-assigned-country";
import { apiGet } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn() }));
vi.stubGlobal("React", React);
afterEach(cleanup);

function Fixture({ fixedCountryId }: { fixedCountryId?: string }) {
  const [assigned, setAssigned] = useState("");
  const [physical, setPhysical] = useState("india");
  return <>
    <CustomerAssignedCountry lang="en" value={assigned} onChange={setAssigned} fixedCountryId={fixedCountryId} />
    <label htmlFor="physical">Residential country</label>
    <select id="physical" value={physical} onChange={(e) => setPhysical(e.target.value)}>
      <option value="india">India</option><option value="pakistan">Pakistan</option>
    </select>
    <output data-testid="pair">{assigned}/{physical}</output>
  </>;
}
const uae = { id: "uae", name: "UAE" };
const pakistan = { id: "pakistan", name: "Pakistan" };
describe("Customer forms' assigned country", () => {
  it("requires an explicit choice among multiple allowed countries and keeps it when the address changes", async () => {
    vi.mocked(apiGet).mockResolvedValue({ countries: [uae, pakistan] });
    render(<Fixture />);
    await screen.findByRole("option", { name: "UAE" });
    expect(screen.getByTestId("pair").textContent).toBe("/india");
    fireEvent.change(screen.getByLabelText(/Assigned Country/), { target: { value: "uae" } });
    fireEvent.change(screen.getByLabelText("Residential country"), { target: { value: "pakistan" } });
    expect(screen.getByTestId("pair").textContent).toBe("uae/pakistan");
  });
  it("locks embedded Branch Owner creation to the branch's country", async () => {
    vi.mocked(apiGet).mockResolvedValue({ countries: [uae, pakistan] });
    render(<Fixture fixedCountryId="uae" />);
    await waitFor(() => expect(screen.getByTestId("pair").textContent).toBe("uae/india"));
    expect((screen.getByLabelText(/Assigned Country/) as HTMLSelectElement).disabled).toBe(true);
  });
  it("selects the only assigned country, not the address", async () => {
    vi.mocked(apiGet).mockResolvedValue({ countries: [uae] });
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("pair").textContent).toBe("uae/india"));
  });
});
