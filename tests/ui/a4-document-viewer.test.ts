import { describe, expect, it } from "vitest";
import { a4FitZoom, A4_PAGE_WIDTH_PX } from "@/components/ui/a4-document-viewer";

describe("A4 document viewer — whole page on any screen", () => {
  it("shows the A4 page at full size when the screen is wide enough", () => {
    expect(A4_PAGE_WIDTH_PX).toBe(794);
    expect(a4FitZoom(1440)).toBe(1);
    expect(a4FitZoom(810)).toBe(1);
  });

  it("scales the whole page down to a phone's width (iPhone 390px, Samsung 360px)", () => {
    expect(a4FitZoom(390)).toBeCloseTo((390 - 16) / 794, 5);
    expect(a4FitZoom(360)).toBeCloseTo((360 - 16) / 794, 5);
  });

  it("never returns a broken zoom", () => {
    expect(a4FitZoom(0)).toBe(1);
    expect(a4FitZoom(Number.NaN)).toBe(1);
    expect(a4FitZoom(100)).toBe(0.3);
  });
});
