// Figma plugin body (SCENE is prepended by export-figma-scene.mjs). Builds one page per concept with every screen as native, editable layers.
(async () => {
  const rgb = (c) => ({ r: c.r, g: c.g, b: c.b });
  const paint = (c) => ({ type: "SOLID", color: rgb(c), opacity: c.a });
  const LATIN = "Inter", ARABIC = "Noto Sans Arabic";
  const STYLES = { 400: ["Regular"], 500: ["Medium", "Regular"], 600: ["Semi Bold", "SemiBold", "Bold"], 700: ["Bold"], 800: ["Extra Bold", "ExtraBold", "Bold"] };
  const fontCache = {};
  async function font(family, wt) {
    const key = family + wt;
    if (fontCache[key]) return fontCache[key];
    const w = wt >= 800 ? 800 : wt >= 700 ? 700 : wt >= 600 ? 600 : wt >= 500 ? 500 : 400;
    for (const fam of [family, LATIN]) {
      for (const style of [...(STYLES[w] || ["Regular"]), "Regular"]) {
        try { await figma.loadFontAsync({ family: fam, style }); return (fontCache[key] = { family: fam, style }); } catch (e) { /* try next */ }
      }
    }
    throw new Error("No usable font found for " + family);
  }
  const isArabic = (s) => /[؀-ۿ]/.test(s);

  function applyFrame(f, n) {
    f.name = n.name || "box";
    f.resizeWithoutConstraints(Math.max(0.01, n.w), Math.max(0.01, n.h));
    const fills = [];
    if (n.fill) fills.push(paint(n.fill));
    if (n.grad) {
      const W = Math.max(1, n.w), H = Math.max(1, n.h), a = (n.grad.angle * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
      const Lpx = Math.abs(W * dx) + Math.abs(H * dy) || 1;
      const Sx = (W / 2 - (dx * Lpx) / 2) / W, Sy = (H / 2 - (dy * Lpx) / 2) / H, Ex = (W / 2 + (dx * Lpx) / 2) / W, Ey = (H / 2 + (dy * Lpx) / 2) / H;
      const vx = Ex - Sx, vy = Ey - Sy, L2 = vx * vx + vy * vy || 1, L = Math.sqrt(L2), px = -vy / L, py = vx / L;
      fills.unshift({ type: "GRADIENT_LINEAR", gradientTransform: [[vx / L2, vy / L2, -(Sx * vx + Sy * vy) / L2], [px / L, py / L, 0.5 - (Sx * px + Sy * py) / L]], gradientStops: n.grad.stops.map((q) => ({ position: Math.min(1, Math.max(0, q.pos)), color: { ...rgb(q.c), a: q.c.a } })) });
    }
    f.fills = fills;
    if (n.stroke) { f.strokes = [paint(n.stroke.c)]; f.strokeWeight = n.stroke.w; f.strokeAlign = "INSIDE"; }
    if (n.r) { f.topLeftRadius = n.r[0]; f.topRightRadius = n.r[1]; f.bottomRightRadius = n.r[2]; f.bottomLeftRadius = n.r[3]; }
    f.clipsContent = !!n.clip;
    if (n.op !== undefined) f.opacity = n.op;
    if (n.shadow) f.effects = [{ type: "DROP_SHADOW", color: { ...rgb(n.shadow.c), a: n.shadow.c.a }, offset: { x: n.shadow.x, y: n.shadow.y }, radius: n.shadow.blur, spread: n.shadow.spread, visible: true, blendMode: "NORMAL" }];
  }

  async function build(n, parent, lang) {
    if (n.t === "svg") {
      try {
        const s = figma.createNodeFromSvg(n.svg);
        parent.appendChild(s); s.name = "Icon"; s.resize(Math.max(1, n.w), Math.max(1, n.h)); s.x = n.x; s.y = n.y; return s;
      } catch (e) { return null; }
    }
    if (n.t === "dash") {
      const l = figma.createLine(); parent.appendChild(l); l.name = "Dashed line";
      const th = n.horiz ? Math.max(1, n.h) : Math.max(1, n.w);
      l.strokes = [paint(n.color)]; l.strokeWeight = th; l.dashPattern = [6, 6];
      if (n.horiz) { l.resize(Math.max(1, n.w), 0); l.x = n.x; l.y = n.y + th / 2; } else { l.resize(Math.max(1, n.h), 0); l.rotation = -90; l.x = n.x + th / 2; l.y = n.y + n.h; }
      return l;
    }
    if (n.t === "text") {
      const t = figma.createText(); parent.appendChild(t); t.name = n.name;
      const fam = isArabic(n.txt) ? ARABIC : LATIN;
      t.fontName = await font(fam, n.wt);
      t.fontSize = Math.max(1, n.size);
      t.characters = n.txt;
      t.fills = [paint(n.color)];
      t.textAlignHorizontal = n.align;
      if (n.ls) t.letterSpacing = { value: n.ls, unit: "PIXELS" };
      if (n.lh) t.lineHeight = { value: n.lh, unit: "PIXELS" };
      if (n.lines === 1 && n.align === "LEFT") { t.textAutoResize = "WIDTH_AND_HEIGHT"; t.x = n.x; t.y = n.y; }
      else { t.textAutoResize = "HEIGHT"; t.resize(Math.max(4, n.w + 10), t.height); t.x = n.align === "RIGHT" ? n.x - 10 : n.align === "CENTER" ? n.x - 5 : n.x; t.y = n.y; }
      return t;
    }
    const f = figma.createFrame(); parent.appendChild(f);
    applyFrame(f, n); f.x = n.x; f.y = n.y;
    for (const k of n.kids) await build(k, f, lang);
    return f;
  }

  const created = [];
  await figma.loadFontAsync({ family: LATIN, style: "Bold" });
  for (const c of SCENE.concepts) {
    const page = figma.createPage();
    page.name = "DGT.llc mobile / Concept " + c.id.toUpperCase() + " — " + c.name;
    await figma.setCurrentPageAsync(page);
    let yStart = 0;
    for (const lang of ["en", "ur"]) {
      const label = figma.createText(); label.fontName = { family: LATIN, style: "Bold" }; label.fontSize = 28;
      label.characters = "Concept " + c.id.toUpperCase() + " — " + c.name + " · " + (lang === "en" ? "English (LTR)" : "Urdu (RTL) — same layout is used for Arabic, Farsi and Pashto");
      page.appendChild(label); label.x = 0; label.y = yStart - 70;
      let x = 0, y = yStart, rowH = 0, col = 0;
      for (const s of c.screens.filter((q) => q.lang === lang)) {
        const fr = await build(s.node, page, lang);
        if (!fr) continue;
        fr.name = lang.toUpperCase() + " · " + s.name;
        if (col === 5 || (s.w > 500 && col > 0)) { x = 0; y += rowH + 90; rowH = 0; col = 0; }
        fr.x = x; fr.y = y; x += s.w + 60; rowH = Math.max(rowH, s.h); col++;
        created.push(fr);
      }
      yStart = y + rowH + 260;
    }
  }
  figma.viewport.scrollAndZoomIntoView(created);
  figma.closePlugin("Created " + created.length + " editable screens on " + SCENE.concepts.length + " pages (3 concepts × English + Urdu RTL).");
})().catch((e) => figma.closePlugin("Error: " + (e && e.message ? e.message : e)));
