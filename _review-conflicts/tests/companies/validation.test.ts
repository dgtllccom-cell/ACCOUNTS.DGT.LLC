import { describe, expect, it } from "vitest";
import { workspaceSetupSchema } from "@/features/companies/validation";

describe("workspace setup validation", () => {
  it("normalizes currency and branch code", () => {
    const result = workspaceSetupSchema.parse({
      companyName: "DGT LLC",
      legalName: "",
      baseCurrency: "usd",
      branchName: "Main Branch",
      branchCode: "main",
      ownerFullName: "Owner User"
    });

    expect(result.baseCurrency).toBe("USD");
    expect(result.branchCode).toBe("MAIN");
  });
});
