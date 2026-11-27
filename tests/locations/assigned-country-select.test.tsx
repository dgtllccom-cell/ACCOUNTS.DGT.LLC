import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AssignedCountrySelect } from "@/features/locations/components/assigned-country-select";
import { apiGet } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn() }));
vi.stubGlobal("React", React);
afterEach(cleanup);

describe("AssignedCountrySelect on an existing Bank / Warehouse", () => {
  it("is read-only in edit mode and shows the saved assigned country even if not selectable", async () => {
    vi.mocked(apiGet).mockResolvedValue({ countries: [{ id: "pk", name: "Pakistan" }] });
    const onChange = vi.fn();
    render(<AssignedCountrySelect lang="en" value="uae" onChange={onChange} fixedCountryId="uae" fixedCountryName="UAE" locked />);
    const select = await screen.findByLabelText(/Assigned Country/) as HTMLSelectElement;
    await screen.findByRole("option", { name: "UAE" });
    expect(select.disabled).toBe(true);
    expect(select.value).toBe("uae");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("never auto-assigns a country to a locked legacy record without one", async () => {
    vi.mocked(apiGet).mockResolvedValue({ countries: [{ id: "uae", name: "UAE" }] });
    const onChange = vi.fn();
    render(<AssignedCountrySelect lang="en" value="" onChange={onChange} locked />);
    await screen.findByRole("option", { name: "UAE" });
    await waitFor(() => expect((screen.getByLabelText(/Assigned Country/) as HTMLSelectElement).disabled).toBe(true));
    expect(onChange).not.toHaveBeenCalled();
  });
});
