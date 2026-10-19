// DOM → editable Figma layers.
//   node docs/design/mobile-concepts/export-figma-scene.mjs
// Reads dist/<concept>-<lang>.html (built by build.mjs), measures every element of every .screen in a real browser and writes
//   figma-plugin/scene.json   (frames, text, vector icons, strokes, radii, gradients, shadows — no screenshots)
//   figma-plugin/code.js      (scene + builder in ONE file: Figma → Plugins → Development → Import plugin from manifest…)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "dist");
const OUT = path.join(HERE, "figma-plugin");
fs.mkdirSync(OUT, { recursive: true });
const CONCEPTS = [["a", "Harbour Ledger"], ["b", "Night Dock"], ["c", "Manifest"]];
const LANGS = ["en", "ur"];

// runs inside the page
const extract = (sel) => {
  const el = document.querySelector(sel);
  const rgba = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3] }; };
  const px = (v) => parseFloat(v) || 0;
  const origin = el.getBoundingClientRect();
  const rel = (r, o) => ({ x: +(r.left - o.left).toFixed(2), y: +(r.top - o.top).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) });
  function radii(cs, w, h) {
    const f = (v) => { v = (v || "0").split(" ")[0]; return v.endsWith("%") ? (parseFloat(v) / 100) * Math.min(w, h) : parseFloat(v) || 0; };
    const r = [f(cs.borderTopLeftRadius), f(cs.borderTopRightRadius), f(cs.borderBottomRightRadius), f(cs.borderBottomLeftRadius)];
    return r.every((x) => x === 0) ? null : r;
  }
  function gradient(bg) {
    const m = bg.match(/^linear-gradient\((.*)\)$/);
    if (!m) return null;
    const parts = []; let depth = 0, cur = "";
    for (const ch of m[1]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch; }
    parts.push(cur.trim());
    let angle = 180; if (/deg$/.test(parts[0])) angle = parseFloat(parts.shift()); else if (/^to /.test(parts[0])) { const d = parts.shift(); angle = { "to bottom": 180, "to top": 0, "to right": 90, "to left": 270 }[d] ?? 180; }
    const stops = parts.map((p, i) => { const c = rgba(p); const pos = p.match(/(-?[\d.]+)%\s*$/); return c ? { c, pos: pos ? parseFloat(pos[1]) / 100 : i / Math.max(1, parts.length - 1) } : null; }).filter(Boolean);
    return stops.length >= 2 ? { angle, stops } : null;
  }
  function node(e, parentRect) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    const r = e.getBoundingClientRect();
    if (r.width < 0.5 && r.height < 0.5) return null;
    const box = rel(r, parentRect);
    if (e.tagName.toLowerCase() === "svg") {
      const c = cs.color;
      let s = e.outerHTML.replace(/currentColor/g, c);
      s = s.replace(/<svg /, `<svg xmlns="http://www.w3.org/2000/svg" `).replace(/xmlns="http:\/\/www.w3.org\/2000\/svg"\s+xmlns="http:\/\/www.w3.org\/2000\/svg"/, 'xmlns="http://www.w3.org/2000/svg"');
      return { t: "svg", ...box, svg: s, name: "Icon" };
    }
    const n = { t: "frame", ...box, name: (e.className && typeof e.className === "string" ? e.className.split(" ")[0] : e.tagName.toLowerCase()) || "box", kids: [] };
    const bg = rgba(cs.backgroundColor); if (bg && bg.a > 0) n.fill = bg;
    const bi = cs.backgroundImage;
    if (bi && bi !== "none") {
      if (/^repeating-linear-gradient/.test(bi)) { const cc = rgba(bi.match(/rgba?\([^)]+\)/)[0]); return { t: "dash", ...box, color: cc, horiz: box.w >= box.h, name: "Dash" }; }
      const g = gradient(bi); if (g) n.grad = g;
    }
    n.r = radii(cs, box.w, box.h);
    if (cs.overflow !== "visible") n.clip = true;
    const op = parseFloat(cs.opacity); if (op < 1) n.op = op;
    // borders
    const sides = [["Top", "t"], ["Right", "r"], ["Bottom", "b"], ["Left", "l"]].map(([S, k]) => ({ k, w: px(cs["border" + S + "Width"]), st: cs["border" + S + "Style"], c: rgba(cs["border" + S + "Color"]) })).filter((s) => s.w > 0 && s.st !== "none" && s.c && s.c.a > 0);
    const extra = [];
    if (sides.length === 4 && sides.every((s) => s.w === sides[0].w && s.st === "solid")) { n.stroke = { c: sides[0].c, w: sides[0].w }; }
    else for (const s of sides) {
      if (s.st === "dashed") { extra.push({ t: "dash", x: s.k === "r" ? box.w - s.w : 0, y: s.k === "b" ? box.h - s.w : 0, w: s.k === "t" || s.k === "b" ? box.w : s.w, h: s.k === "l" || s.k === "r" ? box.h : s.w, color: s.c, horiz: s.k === "t" || s.k === "b", name: "Dash" }); continue; }
      const f = s.k === "t" ? { x: 0, y: 0, w: box.w, h: s.w } : s.k === "b" ? { x: 0, y: box.h - s.w, w: box.w, h: s.w } : s.k === "l" ? { x: 0, y: 0, w: s.w, h: box.h } : { x: box.w - s.w, y: 0, w: s.w, h: box.h };
      extra.push({ t: "frame", ...f, name: "border-" + s.k, fill: s.c, kids: [] });
    }
    // shadows
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      const first = sh.split(/,(?![^(]*\))/)[0].trim(); const col = rgba(first); const nums = first.replace(/rgba?\([^)]+\)/, "").match(/-?[\d.]+px/g)?.map(parseFloat) || [];
      if (col && /inset/.test(first)) { if (nums[0] > 0) extra.push({ t: "frame", x: 0, y: 0, w: nums[0], h: box.h, name: "inset-start", fill: col, kids: [] }); else if (nums[0] < 0) extra.push({ t: "frame", x: box.w + nums[0], y: 0, w: -nums[0], h: box.h, name: "inset-end", fill: col, kids: [] }); }
      else if (col && nums.length >= 3) n.shadow = { x: nums[0], y: nums[1], blur: nums[2], spread: nums[3] || 0, c: col };
    }
    // children in DOM order: element nodes and text runs
    for (const ch of e.childNodes) {
      if (ch.nodeType === 1) { const k = node(ch, r); if (k) n.kids.push(k); }
      else if (ch.nodeType === 3 && ch.nodeValue.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(ch); const rects = [...rg.getClientRects()].filter((q) => q.width > 0);
        if (!rects.length) continue;
        const u = { left: Math.min(...rects.map((q) => q.left)), top: Math.min(...rects.map((q) => q.top)), right: Math.max(...rects.map((q) => q.right)), bottom: Math.max(...rects.map((q) => q.bottom)) };
        let txt = ch.nodeValue.replace(/\s+/g, " ").trim(); if (cs.textTransform === "uppercase") txt = txt.toUpperCase();
        const rtl = cs.direction === "rtl"; const ta = cs.textAlign;
        const align = ta === "center" ? "CENTER" : ta === "right" || (rtl && (ta === "start" || ta === "left" && false)) || (ta === "end" && !rtl) ? "RIGHT" : "LEFT";
        const lines = new Set(rects.map((q) => Math.round(q.top))).size;
        n.kids.push({ t: "text", x: +(u.left - r.left).toFixed(2), y: +(u.top - r.top).toFixed(2), w: +(u.right - u.left).toFixed(2), h: +(u.bottom - u.top).toFixed(2), txt, size: px(cs.fontSize), wt: parseInt(cs.fontWeight) || 400, color: rgba(cs.color), align, rtl, lines, ls: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing), lh: cs.lineHeight === "normal" ? null : px(cs.lineHeight), fam: cs.fontFamily, name: txt.slice(0, 28) });
      }
    }
    n.kids.push(...extra);
    // filter: brightness(x) → dark overlay (Figma has no brightness filter)
    const fl = cs.filter.match(/brightness\(([\d.]+)\)/);
    if (fl && parseFloat(fl[1]) < 1) n.kids.push({ t: "frame", x: 0, y: 0, w: box.w, h: box.h, name: "dim", fill: { r: 0, g: 0, b: 0, a: 1 - parseFloat(fl[1]) }, kids: [] });
    return n;
  }
  const root = node(el, { left: origin.left, top: origin.top });
  root.x = 0; root.y = 0; root.name = el.getAttribute("data-screen");
  return root;
};

const browser = await chromium.launch();
const scene = { concepts: [] };
for (const [id, name] of CONCEPTS) {
  const c = { id, name, screens: [] };
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width: 2000, height: 1200 } });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(path.join(DIST, `${id}-${lang}.html`)).href);
    await page.waitForTimeout(300);
    const names = await page.$$eval(".screen", (els) => els.map((e) => e.getAttribute("data-screen")));
    for (const sn of names) {
      const n = await page.evaluate(extract, `.screen[data-screen="${sn}"]`);
      c.screens.push({ lang, name: sn, w: n.w, h: n.h, node: n });
    }
    await ctx.close();
  }
  scene.concepts.push(c);
  console.log("exported", id, c.screens.length, "screens");
}
await browser.close();
fs.writeFileSync(path.join(OUT, "scene.json"), JSON.stringify(scene));
const builder = fs.readFileSync(path.join(HERE, "plugin-builder.js"), "utf8");
fs.writeFileSync(path.join(OUT, "code.js"), `/* DGT.llc B / BS — mobile design concepts A/B/C: native editable Figma layers (generated; do not edit by hand) */\nconst SCENE = ${JSON.stringify(scene)};\n${builder}`);
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ name: "DGT.llc B / BS — Mobile Concepts (editable)", id: "dgtllc-mobile-concepts", api: "1.0.0", main: "code.js", editorType: ["figma"], documentAccess: "dynamic-page" }, null, 2));
console.log("plugin written:", OUT, (fs.statSync(path.join(OUT, "code.js")).size / 1e6).toFixed(2) + " MB");
