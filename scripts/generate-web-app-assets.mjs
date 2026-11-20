#!/usr/bin/env node
/**
 * Home-screen app assets for iPhone / iPad / Android (the installable web app at api.dgt.llc):
 *  - square PNG icons from the Damaan logo (the logo file is a non-square JPEG, so iOS showed it cropped);
 *  - iPhone / iPad launch screens (without them the installed app opened on a blank white screen).
 * Re-run after the logo changes:  node scripts/generate-web-app-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const LOGO = "public/images/damaan-logo.png";
const OUT = "public/app";
const NAVY = "#0a1f45";
const PAPER = { r: 253, g: 249, b: 245, alpha: 1 }; // the logo's own off-white background

fs.mkdirSync(OUT, { recursive: true });

/** the logo centred on a square of `size`, the logo taking `fill` of the side */
async function squareIcon(size, fill, file, background = PAPER) {
  const inner = Math.round(size * fill);
  const logo = await sharp(LOGO).resize(inner, inner, { fit: "contain", background }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(OUT, file));
}

await squareIcon(180, 0.94, "icon-180.png"); // iOS apple-touch-icon (iOS rounds the corners itself)
await squareIcon(192, 0.94, "icon-192.png");
await squareIcon(512, 0.94, "icon-512.png");
await squareIcon(512, 0.72, "icon-maskable-512.png"); // Android masks: keep the logo inside the 80% safe zone

/** portrait launch screen: navy, the logo in a white disc, the app name under it */
async function splash(w, h, file) {
  const disc = Math.round(Math.min(w, h) * 0.42);
  const logo = await sharp(LOGO).resize(Math.round(disc * 0.7), Math.round(disc * 0.7), { fit: "contain", background: PAPER }).png().toBuffer();
  const fontSize = Math.round(Math.min(w, h) * 0.05);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${NAVY}"/>
    <circle cx="${w / 2}" cy="${h * 0.44}" r="${disc / 2}" fill="rgb(253,249,245)"/>
    <text x="${w / 2}" y="${h * 0.44 + disc / 2 + fontSize * 2}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}"
      font-weight="700" fill="#ffffff" text-anchor="middle">Damaan Business Group</text>
    <text x="${w / 2}" y="${h * 0.44 + disc / 2 + fontSize * 3.3}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(fontSize * 0.6)}"
      fill="#c9a24a" text-anchor="middle">DGT.LLC</text>
  </svg>`);
  await sharp(svg)
    .composite([{ input: logo, top: Math.round(h * 0.44 - (disc * 0.7) / 2), left: Math.round(w / 2 - (disc * 0.7) / 2) }])
    .png({ compressionLevel: 9, palette: true, quality: 85 })
    .toFile(path.join(OUT, file));
}

// CSS size × pixel ratio of common iPhones / iPads (portrait). Keep in sync with APPLE_STARTUP_IMAGES in app/layout.tsx.
export const SPLASHES = [
  { w: 375, h: 667, r: 2 },   // iPhone SE / 8
  { w: 414, h: 896, r: 2 },   // iPhone 11 / XR
  { w: 390, h: 844, r: 3 },   // iPhone 12–14
  { w: 393, h: 852, r: 3 },   // iPhone 15 / 16
  { w: 430, h: 932, r: 3 },   // iPhone Pro Max / Plus
  { w: 820, h: 1180, r: 2 },  // iPad Air / iPad 10
  { w: 834, h: 1194, r: 2 },  // iPad Pro 11
  { w: 1024, h: 1366, r: 2 }, // iPad Pro 12.9
];
for (const s of SPLASHES) await splash(s.w * s.r, s.h * s.r, `splash-${s.w}x${s.h}@${s.r}x.png`);

console.log(`web app assets written to ${OUT}/`);
