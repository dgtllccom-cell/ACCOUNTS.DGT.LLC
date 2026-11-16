import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { EmployeeProfileDrawer } from "@/features/hr-payroll/components/employee-profile-drawer";
const state = vi.hoisted(() => ({ lang: "en", get: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => state.lang }));
vi.mock("@/lib/api/client", () => ({ apiGet: state.get }));
vi.mock("@/components/ui/detail-drawer", () => ({ DetailDrawer: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/ui/employee-certificate-print", () => ({ printEmployeeCertificate: vi.fn() }));
beforeEach(() => { state.lang = "en"; state.get.mockReset(); });
afterEach(cleanup);

it("refreshes employee data for each viewer language without changing the employee", async () => {
  state.get.mockImplementation(async (url: string) => ({ employee: { id: "employee-test", person: { customer_name: url.split("lang=")[1] } } }));
  const props = { isOpen: true, onClose: () => {}, employeeId: "employee-test" };
  const view = render(<EmployeeProfileDrawer {...props} />);
  for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
    state.lang = lang;
    view.rerender(<EmployeeProfileDrawer {...props} />);
    await waitFor(() => expect(state.get).toHaveBeenLastCalledWith(`/api/erp/hr-payroll/employees/employee-test?lang=${lang}`));
  }
});

it("ignores a previous language response that arrives after the current one", async () => {
  let resolveOld: (value: any) => void = () => {};
  state.get.mockImplementation((url: string) => url.endsWith("lang=en") ? new Promise((resolve) => {resolveOld = resolve;}) : Promise.resolve({ employee: { id: "employee-test", person: {customer_name: "CURRENT_LANGUAGE_NAME"} } }));
  const props = { isOpen: true, onClose: () => {}, employeeId: "employee-test" };
  const view = render(<EmployeeProfileDrawer {...props} />);
  state.lang = "ur";
  view.rerender(<EmployeeProfileDrawer {...props} />);
  await screen.findByText("CURRENT_LANGUAGE_NAME");
  await act(async () => { resolveOld({employee: {id: "employee-test", person: { customer_name: "STALE_LANGUAGE_NAME" }}}); });
  expect(screen.queryByText("STALE_LANGUAGE_NAME")).toBeNull();
  expect(screen.getByText("CURRENT_LANGUAGE_NAME")).toBeTruthy();
});
