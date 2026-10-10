#!/usr/bin/env node
/**
 * DigiTic brand assets → Android mipmaps / splash, iOS AppIcon / splash, and store graphics.
 * The mark is a white "D" with a teal tick on the DGT navy. It is a working brand mark: replace the SVG below with the
 * owner's final artwork and re-run `node scripts/generate-digitic-icons.mjs` — every size is regenerated.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const NAVY = "#0a1f45", BLUE = "#1d4ed8", TEAL = "#2dd4bf";
const D = "M330 270H520C700 270 790 370 790 512C790 654 700 754 520 754H330Z M420 360V664H515C625 664 690 604 690 512C690 420 625 360 515 360Z";
const TICK = "M468 520L522 576L628 446";

const mark = (withBg, size = 1024, scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
  ${withBg ? `<rect width="1024" height="1024" fill="url(#g)"/>` : ""}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="${D}" fill="#fff" fill-rule="evenodd"/>
    <path d="${TICK}" fill="none" stroke="${TEAL}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const png = async (svg, out, w, h = w) => { fs.mkdirSync(path.dirname(out), { recursive: true }); await sharp(Buffer.from(svg)).resize(w, h, { fit: "cover" }).png().toFile(out); };
const R = "android/app/src/main/res";

// Android launcher icons
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, s] of Object.entries(dens)) {
  await png(mark(true, 1024), `${R}/mipmap-${d}/ic_launcher.png`, s);
  const round = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath></defs><g clip-path="url(#c)">${mark(true).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
  await png(round, `${R}/mipmap-${d}/ic_launcher_round.png`, s);
  await png(mark(false, 1024, 0.62), `${R}/mipmap-${d}/ic_launcher_foreground.png`, fg[d]); // adaptive icon: art kept inside the safe zone
}
fs.writeFileSync(`${R}/drawable/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n    <path android:fillColor="${NAVY}" android:pathData="M0,0h108v108h-108z" />\n</vector>\n`);

// splash screens (navy + centred mark), same pixel sizes the project already had
const splash = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${NAVY}"/><g transform="translate(${(w - Math.min(w, h) * 0.34) / 2} ${(h - Math.min(w, h) * 0.34) / 2}) scale(${(Math.min(w, h) * 0.34) / 1024})">${mark(true).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
for (const dir of fs.readdirSync(R).filter((x) => /^drawable(-(port|land)-.*)?$/.test(x))) {
  const p = `${R}/${dir}/splash.png`;
  if (!fs.existsSync(p)) continue;
  const m = await sharp(p).metadata();
  await png(splash(m.width, m.height), p, m.width, m.height);
}

// iOS
const I = "ios/App/App/Assets.xcassets";
await sharp(Buffer.from(mark(true, 1024))).flatten({ background: NAVY }).png().toFile(`${I}/AppIcon.appiconset/AppIcon-512@2x.png`); // App Store icons must have no alpha
for (const f of fs.readdirSync(`${I}/Splash.imageset`).filter((x) => x.endsWith(".png"))) await png(splash(2732, 2732), `${I}/Splash.imageset/${f}`, 2732);

// store graphics
const S = "docs/store/assets";
await png(mark(true, 1024), `${S}/digitic-icon-1024.png`, 1024);
await png(mark(true, 1024), `${S}/digitic-play-icon-512.png`, 512);
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${BLUE}"/></linearGradient></defs><rect width="1024" height="500" fill="url(#f)"/><g transform="translate(70 90) scale(0.32)">${mark(false).replace(/<\/?svg[^>]*>/g, "")}</g><text x="470" y="255" font-family="Segoe UI, Arial, sans-serif" font-size="110" font-weight="700" fill="#fff">DigiTic</text><text x="474" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#cfe0ff">DGT ERP in your pocket</text></svg>`;
await png(feature, `${S}/digitic-feature-graphic-1024x500.png`, 1024, 500);
// ---- the two store apps: "DGT.llc B" (Business) and "DGT.llc BS" (Business Shipping) ---------------------------------------------
// Android: one product flavor each (android/app/src/<flavor>/res). iOS: AppIcon (B) and AppIcon-BS appiconsets.
const APPS = [
  { key: "b", flavor: "business", name: "DGT.llc B", letters: "B", c1: "#1d4ed8", c2: NAVY },
  { key: "bs", flavor: "shipping", name: "DGT.llc BS", letters: "BS", c1: "#0e7490", c2: NAVY },
];
const letterMark = (a, bg, size = 1024, scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g${a.key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/></linearGradient></defs>
  ${bg ? `<rect width="1024" height="1024" fill="url(#g${a.key})"/>` : ""}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <text x="512" y="${a.letters.length > 1 ? 590 : 600}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="${a.letters.length > 1 ? 400 : 520}" fill="#fff">${a.letters}</text>
    <path d="M300 700Q406 640 512 700T724 700" fill="none" stroke="${TEAL}" stroke-width="36" stroke-linecap="round"/>
  </g>
</svg>`;
const appSplash = (a, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${a.c2}"/><g transform="translate(${(w - Math.min(w, h) * 0.34) / 2} ${(h - Math.min(w, h) * 0.34) / 2}) scale(${(Math.min(w, h) * 0.34) / 1024})">${letterMark(a, true).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
for (const a of APPS) {
  const FR = `android/app/src/${a.flavor}/res`;
  for (const [d, sz] of Object.entries(dens)) {
    await png(letterMark(a, true), `${FR}/mipmap-${d}/ic_launcher.png`, sz);
    const rnd = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><clipPath id="c${a.key}"><circle cx="512" cy="512" r="512"/></clipPath></defs><g clip-path="url(#c${a.key})">${letterMark(a, true).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`;
    await png(rnd, `${FR}/mipmap-${d}/ic_launcher_round.png`, sz);
    await png(letterMark(a, false, 1024, 0.62), `${FR}/mipmap-${d}/ic_launcher_foreground.png`, fg[d]);
  }
  fs.mkdirSync(`${FR}/drawable`, { recursive: true });
  fs.writeFileSync(`${FR}/drawable/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="${a.c2}" android:pathData="M0,0h108v108h-108z" />
</vector>
`);
  for (const dir of fs.readdirSync(R).filter((x) => /^drawable(-(port|land)-.*)?$/.test(x))) {
    const p0 = `${R}/${dir}/splash.png`;
    if (!fs.existsSync(p0)) continue;
    const m = await sharp(p0).metadata();
    await png(appSplash(a, m.width, m.height), `${FR}/${dir}/splash.png`, m.width, m.height);
  }
  // store graphics per app
  const SA = `docs/store/assets/${a.key}`;
  await sharp(Buffer.from(letterMark(a, true))).flatten({ background: a.c2 }).png().toFile((fs.mkdirSync(SA, { recursive: true }), `${SA}/icon-1024.png`));
  await png(letterMark(a, true), `${SA}/play-icon-512.png`, 512);
  const feat = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><defs><linearGradient id="f${a.key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.c2}"/><stop offset="1" stop-color="${a.c1}"/></linearGradient></defs><rect width="1024" height="500" fill="url(#f${a.key})"/><g transform="translate(70 90) scale(0.32)">${letterMark(a, false).replace(/<\/?svg[^>]*>/g, "")}</g><text x="440" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="700" fill="#fff">${a.name}</text><text x="444" y="318" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#cfe0ff">${a.key === "b" ? "Your DGT business ERP" : "Shipping Line &amp; Clearing Agent ERP"}</text></svg>`;
  await png(feat, `${SA}/feature-graphic-1024x500.png`, 1024, 500);
}
// iOS: B uses the default AppIcon set; BS gets its own set (selected with ASSETCATALOG_COMPILER_APPICON_NAME=AppIcon-BS when archiving)
{
  const a = APPS[0];
  await sharp(Buffer.from(letterMark(a, true))).flatten({ background: a.c2 }).png().toFile(`${I}/AppIcon.appiconset/AppIcon-512@2x.png`);
  const b = APPS[1];
  fs.mkdirSync(`${I}/AppIcon-BS.appiconset`, { recursive: true });
  await sharp(Buffer.from(letterMark(b, true))).flatten({ background: b.c2 }).png().toFile(`${I}/AppIcon-BS.appiconset/AppIcon-512@2x.png`);
  fs.copyFileSync(`${I}/AppIcon.appiconset/Contents.json`, `${I}/AppIcon-BS.appiconset/Contents.json`);
  for (const f of fs.readdirSync(`${I}/Splash.imageset`).filter((x) => x.endsWith(".png"))) await png(appSplash(a, 2732, 2732), `${I}/Splash.imageset/${f}`, 2732);
}
console.log("DigiTic brand assets generated");
