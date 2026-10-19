// Sanity check of the exporter: re-draws a screen from scene.json ALONE (absolute boxes, no original CSS) so it can be compared with the source PNG.
//   node docs/design/mobile-concepts/scene-preview.mjs <concept> <lang> <screen>
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [cid, lang, name] = process.argv.slice(2);
const scene = JSON.parse(fs.readFileSync(path.join(HERE, "figma-plugin/scene.json"), "utf8"));
const s = scene.concepts.find((c) => c.id === cid).screens.find((q) => q.lang === lang && q.name === name);
const col = (c) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
const draw = (n) => {
  if (n.t === "svg") return `<div style="position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px">${n.svg}</div>`;
  if (n.t === "dash") return `<div style="position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;border-${n.horiz ? "top" : "left"}:${n.horiz ? n.h : n.w}px dashed ${col(n.color)}"></div>`;
  if (n.t === "text") return `<div style="position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w + 6}px;text-align:${n.align.toLowerCase()};font:${n.wt} ${n.size}px/${n.lh || "normal"}px ${/[؀-ۿ]/.test(n.txt) ? "'Noto Sans Arabic','Segoe UI'" : "Inter"},sans-serif;color:${col(n.color)};letter-spacing:${n.ls || 0}px;white-space:pre-wrap;direction:${/[؀-ۿ]/.test(n.txt) ? "rtl" : "ltr"}">${n.txt}</div>`;
  const bg = [n.grad ? `linear-gradient(${n.grad.angle}deg,${n.grad.stops.map((q) => col(q.c) + " " + q.pos * 100 + "%").join(",")})` : null].filter(Boolean).join(",");
  const r = n.r ? n.r.map((x) => x + "px").join(" ") : "0";
  return `<div style="position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;${n.fill ? "background-color:" + col(n.fill) + ";" : ""}${bg ? "background-image:" + bg + ";" : ""}border-radius:${r};${n.stroke ? `box-shadow:inset 0 0 0 ${n.stroke.w}px ${col(n.stroke.c)};` : ""}${n.shadow ? `filter:drop-shadow(${n.shadow.x}px ${n.shadow.y}px ${n.shadow.blur / 2}px ${col(n.shadow.c)});` : ""}${n.clip ? "overflow:hidden;" : ""}${n.op !== undefined ? "opacity:" + n.op + ";" : ""}">${(n.kids || []).map(draw).join("")}</div>`;
};
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
await p.setContent(`<body style="margin:0;background:#888"><div style="position:relative;width:${s.w}px;height:${s.h}px">${draw(s.node)}</div></body>`);
await p.screenshot({ path: path.join(HERE, `dist/scene-preview-${cid}-${lang}-${name}.png`) }); await b.close(); console.log("ok");
