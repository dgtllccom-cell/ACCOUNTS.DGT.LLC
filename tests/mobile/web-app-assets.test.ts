import fs from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { metadata } from "@/app/layout";

const pngSize = (file: string) => {
  const b = fs.readFileSync(`public${file}`);
  expect(b.subarray(1, 4).toString(), file).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe("installable iPhone / iPad / Android app", () => {
  it("manifest icons are real square PNGs of the stated size", () => {
    const icons = manifest().icons || [];
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const i of icons) {
      const [w, h] = pngSize(i.src);
      expect(`${w}x${h}`).toBe(i.sizes);
    }
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("iOS gets a 180x180 home-screen icon and a launch screen for each listed iPhone / iPad", () => {
    const apple = (metadata.icons as any).apple[0];
    expect(pngSize(apple.url)).toEqual([180, 180]);
    const startup = (metadata.appleWebApp as any).startupImage as { url: string; media: string }[];
    expect(startup.length).toBeGreaterThanOrEqual(8);
    for (const s of startup) {
      const m = s.url.match(/splash-(\d+)x(\d+)@(\d)x\.png$/)!;
      expect(pngSize(s.url)).toEqual([Number(m[1]) * Number(m[3]), Number(m[2]) * Number(m[3])]);
      expect(s.media).toContain(`(device-width: ${m[1]}px)`);
    }
  });
});
