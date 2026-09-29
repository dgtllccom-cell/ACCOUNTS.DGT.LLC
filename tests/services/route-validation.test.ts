import { describe, expect, it } from "vitest";
import { landPath, sharesLandBorder, validateRoute, type RouteLeg } from "@/lib/shipping/route-validation";

const leg = (legNo: number, fromIso2: string, toIso2: string, transportMode: string, extra: Partial<RouteLeg> = {}): RouteLeg => ({ legNo, fromIso2, toIso2, transportMode, ...extra });

describe("land borders", () => {
  it("knows the corridor borders", () => {
    expect(sharesLandBorder("PK", "AF")).toBe(true);
    expect(sharesLandBorder("AF", "UZ")).toBe(true);
    expect(sharesLandBorder("IR", "PK")).toBe(true);
    expect(sharesLandBorder("PK", "UZ")).toBe(false);
    expect(sharesLandBorder("AE", "IR")).toBe(false);
  });
  it("suggests the shortest land path", () => {
    expect(landPath("PK", "UZ")).toEqual(["PK", "AF", "UZ"]);
  });
});

describe("route", () => {
  it("accepts Dubai → Iran (sea) → Pakistan → Afghanistan → Uzbekistan (road) → India (air)", () => {
    const issues = validateRoute([
      leg(1, "AE", "IR", "by_sea", { portOfLoading: "Jebel Ali", portOfDischarge: "Bandar Abbas" }),
      leg(2, "IR", "PK", "by_road", { borderCrossing: "Taftan" }),
      leg(3, "PK", "AF", "by_road", { borderCrossing: "Torkham" }),
      leg(4, "AF", "UZ", "by_road", { borderCrossing: "Hairatan – Termez" }),
      leg(5, "UZ", "IN", "by_air", { fromLocation: "Tashkent TAS", toLocation: "Delhi DEL" }),
    ]);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });
  it("rejects a direct Pakistan → Uzbekistan road leg and suggests Afghanistan", () => {
    const issues = validateRoute([leg(1, "PK", "UZ", "by_road", { borderCrossing: "x" })]);
    const e = issues.find((i) => i.code === "no_land_border");
    expect(e?.level).toBe("error");
    expect(e?.suggestion).toEqual(["PK", "AF", "UZ"]);
  });
  it("flags a missing border crossing (warning while planned, error once dispatched) and a gap between legs", () => {
    const planned = validateRoute([leg(1, "PK", "AF", "by_road"), leg(2, "UZ", "IN", "by_air", { flightOrAwb: "HY-421" })]);
    expect(planned.map((i) => `${i.code}:${i.level}`).sort()).toEqual(["border_crossing_required:warning", "route_gap:error"]);
    const moving = validateRoute([leg(1, "PK", "AF", "by_road", { status: "in_transit" })]);
    expect(moving.map((i) => `${i.code}:${i.level}`)).toEqual(["border_crossing_required:error"]);
  });
  it("allows a domestic road leg without a border crossing", () => {
    expect(validateRoute([leg(1, "PK", "PK", "by_road")])).toEqual([]);
  });
});
