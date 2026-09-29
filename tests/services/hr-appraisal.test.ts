import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: vi.fn(), withReadPg: vi.fn() }));
vi.mock("@/lib/services/hr-api", () => ({ assertEmployeeAccess: vi.fn(), hasHrRole: vi.fn() }));
vi.mock("@/lib/api/scope-middleware", () => ({ recordInSessionScope: vi.fn(), sessionSqlScope: vi.fn(), sqlScopeCondition: vi.fn() }));
vi.mock("@/lib/user-tasks/service", () => ({ createTask: vi.fn() }));

import { overallRating, periodFor, ratingBand } from "@/lib/services/hr-appraisal-service";

describe("appraisal rating", () => {
  it("is the weight-averaged goal score", () => {
    expect(overallRating([{ weight: 60, score: 4 }, { weight: 40, score: 3 }])).toBe(3.6);
    expect(overallRating([{ weight: 50, score: 5 }, { weight: 50, score: 2 }])).toBe(3.5);
  });
  it("stays empty until every goal is scored", () => {
    expect(overallRating([{ weight: 60, score: 4 }, { weight: 40, score: null }])).toBeNull();
    expect(overallRating([])).toBeNull();
  });
  it("maps to bands", () => {
    expect(ratingBand(4.5)).toBe("outstanding");
    expect(ratingBand(3.6)).toBe("exceeds");
    expect(ratingBand(2.5)).toBe("meets");
    expect(ratingBand(2.4)).toBe("needs_improvement");
    expect(ratingBand(1.2)).toBe("unsatisfactory");
    expect(ratingBand(null)).toBeNull();
  });
});

describe("review periods", () => {
  it("resolves quarters and years", () => {
    expect(periodFor("quarterly", "2026-Q1")).toEqual({ label: "2026-Q1", start: "2026-01-01", end: "2026-03-31" });
    expect(periodFor("quarterly", "2024-Q1").end).toBe("2024-03-31");
    expect(periodFor("quarterly", "2026-Q3")).toEqual({ label: "2026-Q3", start: "2026-07-01", end: "2026-09-30" });
    expect(periodFor("annual", "2026")).toEqual({ label: "2026", start: "2026-01-01", end: "2026-12-31" });
  });
  it("rejects malformed periods", () => {
    expect(() => periodFor("quarterly", "2026-Q5")).toThrow();
    expect(() => periodFor("annual", "26")).toThrow();
    expect(() => periodFor("custom", null, "2026-05-01", "2026-04-01")).toThrow();
  });
});
