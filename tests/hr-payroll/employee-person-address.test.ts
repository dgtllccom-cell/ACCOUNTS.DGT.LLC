import { describe, expect, it } from "vitest";
import { employeePersonAddress, resolveEmployeePerson } from "@/features/hr-payroll/employee-person-address";

describe("Employee addresses come from the linked Person Master", () => {
  it("uses the saved person's address rather than their employment branch", () => {
    expect(employeePersonAddress({ id: "1", address: "  12 Main Road, Mumbai  ", city_name: "Mumbai" })).toBe("12 Main Road, Mumbai");
    expect(employeePersonAddress({ id: "1", city_name: "Mumbai", state_province_name: "Maharashtra", country_name: "India" })).toBe("Mumbai, Maharashtra, India");
    expect(employeePersonAddress({ id: "1" })).toBeNull();
  });

  it("does not display a previously loaded person's address after changing person", () => {
    const oldPerson = { id: "1", address: "Old person address" };
    const newPerson = { id: "2", address: "Current person address" };
    expect(resolveEmployeePerson("2", oldPerson, [newPerson])).toBe(newPerson);
    expect(resolveEmployeePerson("2", oldPerson, [])).toBeNull();
  });
});
