import { describe, expect, it } from "vitest";
import { accountFormSchema } from "@/features/accounts/validation";

describe("account validation", () => {
  it("accepts a control account payload", () => {
    const result = accountFormSchema.parse({
      companyId: "00000000-0000-0000-0000-000000000001",
      branchId: "",
      parentId: "",
      code: "1010",
      name: "Main cash",
      kind: "asset",
      currency: "USD",
      isControlAccount: true
    });

    expect(result.kind).toBe("asset");
  });
});
