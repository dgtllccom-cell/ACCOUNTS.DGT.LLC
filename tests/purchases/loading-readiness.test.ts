import { describe, expect, it } from "vitest";
import { loadingReadinessNote } from "@/lib/purchases/loading-readiness";

describe("why a saved bill is not in Loading yet", () => {
  it("a saved, untransferred credit / final / cash bill must be transferred first (AE-001-0005, LP 5af5944f)", () => {
    expect(loadingReadinessNote({ saved: true, posted: false, paymentTerms: "Credit" })).toBe("transfer_first");
    expect(loadingReadinessNote({ saved: true, posted: false, paymentTerms: "Credit (Due: 2026-12-19)" })).toBe("transfer_first");
    expect(loadingReadinessNote({ saved: true, posted: false, paymentTerms: "Final Payment" })).toBe("transfer_first");
    expect(loadingReadinessNote({ saved: true, posted: false, paymentTerms: "Cash" })).toBe("transfer_first");
  });
  it("an advance bill: transfer, then the advance must be paid", () => {
    expect(loadingReadinessNote({ saved: true, posted: false, paymentTerms: "Advance Payment" })).toBe("transfer_then_advance");
  });
  it("no note for a new (unsaved) bill or a transferred one", () => {
    expect(loadingReadinessNote({ saved: false, posted: false, paymentTerms: "Credit" })).toBeNull();
    expect(loadingReadinessNote({ saved: true, posted: true, paymentTerms: "Credit" })).toBeNull();
    expect(loadingReadinessNote({ saved: true, posted: true, paymentTerms: "Advance Payment" })).toBeNull();
  });
});
