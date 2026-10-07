// DEV-only interactive walker (WebKit): open a page, run a list of steps (click by visible text / selector, fill, select),
// and after every step report layout metrics + screenshot. Env: BASE, RBAC_SECRET, OUT, PAGE_PATH, STEPS (json), DEVICE, LANG_CODE, THEME, DUMP=1
// STEPS item: {"click":"Manual Entry"} | {"clickSel":"css"} | {"fill":["css","value"]} | {"select":["css","value"]} | {"wait":ms} | {"shot":"name"} | {"scroll":px}
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const STEPS = JSON.parse(process.env.STEPS || "[]");
const DEVS = {
  "iphone-se": { w: 375, h: 667, dpr: 2, phone: true }, iphone15: { w: 393, h: 852, dpr: 3, phone: true },
  "iphone-land": { w: 956, h: 440, dpr: 3, phone: true }, samsung: { w: 412, h: 915, dpr: 3, phone: true },
  huawei: { w: 360, h: 780, dpr: 3, phone: true }, "ipad-p": { w: 820, h: 1180, dpr: 2 }, "ipad-l": { w: 1180, h: 820, dpr: 2 },
};
const D = DEVS[process.env.DEVICE || "iphone15"];
const LANG = process.env.LANG_CODE || "en"; const THEME = process.env.THEME || "day";
const UA = D.phone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

export const measure = () => {
  const vw = innerWidth;
  const de = document.documentElement;
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return p; } return null; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  // anything (incl. inputs / selects, not only text) that pokes past the viewport edge outside a scroller — also inside fixed modals
  const outside = [...document.querySelectorAll("button, a, input, select, textarea, h1, h2, h3, h4, label, [role=dialog] *, th, td")]
    .filter((el) => vis(el) && !inScroller(el) && (el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1))
    .slice(0, 8).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.placeholder || el.name || "").trim().slice(0, 26)}`);
  const narrowCodes = [...document.querySelectorAll("td, span.font-mono, [class*=font-mono]")]
    .filter((el) => { if (!vis(el)) return false; const t = (el.textContent || "").trim(); if (t.length < 5 || t.length > 40 || /\s/.test(t)) return false; const r = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) || 16; return r.height > lh * 1.6; })
    .slice(0, 5).map((el) => el.textContent.trim());
  const tiny = [...document.querySelectorAll("button, a, input, select")].filter((el) => { if (!vis(el)) return false; const r = el.getBoundingClientRect(); return r.height < 28 && r.width < 28; }).length;
  const nav = document.querySelector("nav.fixed.bottom-0"); const fab = document.querySelector("button[aria-label='Open chat']");
  let fabOverNav = false;
  if (nav && fab && getComputedStyle(nav).display !== "none") { const a = nav.getBoundingClientRect(), b = fab.getBoundingClientRect(); fabOverNav = !(b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right); }
  const tables = [...document.querySelectorAll("table")].filter(vis);
  return { overflowX: de.scrollWidth > vw + 1, outside, narrowCodes, tinyTargets: tiny, fabOverNav, tablesNoScroller: tables.filter((t) => !inScroller(t)).length, tables: tables.length, dialogs: document.querySelectorAll("[role=dialog], .fixed.inset-0").length, h: de.scrollHeight };
};
const dump = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const txt = (el) => (el.textContent || el.value || el.placeholder || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return {
    headings: [...document.querySelectorAll("[data-erp-content] h1, [data-erp-content] h2, [data-erp-content] h3")].filter(vis).map(txt).slice(0, 14),
    buttons: [...document.querySelectorAll("[data-erp-content] button, [role=dialog] button")].filter(vis).map(txt).filter(Boolean).slice(0, 40),
    fields: [...document.querySelectorAll("[data-erp-content] input, [data-erp-content] select, [data-erp-content] textarea")].filter(vis).map((e) => `${e.tagName.toLowerCase()}[${e.type || ""}] ${e.name || e.id || ""} ${(e.placeholder || "").slice(0, 24)}`).slice(0, 40),
  };
};

const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: true, hasTouch: true, userAgent: UA });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: THEME, domain: "localhost", path: "/" }]);
await ctx.addInitScript(([t, l]) => { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); }, [THEME, LANG]);
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
await page.goto(BASE + process.env.PAGE_PATH, { waitUntil: "networkidle", timeout: 240000 });
await page.waitForSelector("[data-erp-content] h1, [data-erp-content] h2, [data-erp-content] h3, [data-erp-content] button", { timeout: 180000 }).catch(() => {});
await page.waitForTimeout(2500);
let n = 0;
const snap = async (label) => {
  const m = await page.evaluate(measure);
  const file = `${OUT}/${String(++n).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.png`;
  await page.screenshot({ path: file });
  const bad = m.overflowX || m.outside.length || m.narrowCodes.length || m.fabOverNav || m.tablesNoScroller;
  console.log(`${bad ? "ISSUE" : "ok   "} [${label}] ${page.url().replace(BASE, "")}`, JSON.stringify(m));
  if (process.env.DUMP) console.log("   ", JSON.stringify(await page.evaluate(dump)));
  return m;
};
await snap("start");
for (const st of STEPS) {
  try {
    if (st.click) await page.locator("button, a, [role=button]", { hasText: st.click }).first().click({ timeout: 15000 });
    else if (st.clickSel) await page.locator(st.clickSel).first().click({ timeout: 8000 });
    else if (st.fill) await page.locator(st.fill[0]).first().fill(st.fill[1], { timeout: 8000 });
    else if (st.select) await page.locator(st.select[0]).first().selectOption(st.select[1], { timeout: 8000 });
    else if (st.probe) {
      const out = await page.evaluate((q) => {
        const el = [...document.querySelectorAll("button, a, td, span, div, p")].filter((e) => e.children.length < 4 && (e.textContent || "").trim().startsWith(q)).sort((a, b) => a.textContent.length - b.textContent.length)[0];
        if (!el) return "not found";
        const chain = []; for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n), r = n.getBoundingClientRect(); chain.push(`${n.tagName.toLowerCase()}.${(n.className || "").toString().split(" ").slice(0, 7).join(".")} ox=${cs.overflowX} wrap=${cs.flexWrap} disp=${cs.display} w=${Math.round(r.width)} sw=${n.scrollWidth} l=${Math.round(r.left)} r=${Math.round(r.right)}`); if (chain.length > 9) break; }
        return chain;
      }, st.probe);
      console.log("PROBE", st.probe, JSON.stringify(out, null, 1));
    }
    else if (st.autofill) {
      // DEV-test data only: fill every visible empty field of the current screen and pick the first option of every empty dropdown. Never submits.
      for (let pass = 0; pass < 3; pass++) {
        for (const sel of await page.locator("select:visible").all()) {
          const v = await sel.inputValue().catch(() => "x"); if (v) continue;
          const opts = await sel.locator("option").evaluateAll((o) => o.filter((x) => x.value && !x.disabled).map((x) => x.value));
          if (opts.length) await sel.selectOption(opts[0]).catch(() => {});
        }
        for (const trg of await page.locator("button[aria-haspopup=dialog][data-state=closed].text-muted-foreground:visible").all()) {
          try { await trg.click({ timeout: 3000 }); await page.waitForTimeout(700); const it = page.locator("[cmdk-item]:not([data-disabled=true])").first(); if (await it.count()) { await it.click({ timeout: 3000 }); } else await page.keyboard.press("Escape"); await page.waitForTimeout(500); } catch { await page.keyboard.press("Escape").catch(() => {}); }
        }
        for (const inp of await page.locator("input:visible, textarea:visible").all()) {
          try {
            const t = (await inp.getAttribute("type")) || "text"; if (["hidden", "checkbox", "radio", "file", "password", "button", "submit", "range", "color"].includes(t)) continue;
            if (await inp.isDisabled() || await inp.getAttribute("readonly") !== null || (await inp.inputValue())) continue;
            if (await inp.getAttribute("role") === "combobox") continue;
            if (await inp.evaluate((e) => !!e.closest("header, nav, [data-dgt-connect]"))) continue;
            const val = t === "number" ? "10" : t === "date" ? new Date().toISOString().slice(0, 10) : t === "email" ? "devtest@dgt.llc" : t === "tel" ? "+971500000000" : "DEVTEST 1";
            await inp.fill(val, { timeout: 2000 });
          } catch {}
        }
        await page.waitForTimeout(600);
      }
    }
    else if (st.wait) await page.waitForTimeout(st.wait);
    else if (st.scroll !== undefined) await page.evaluate((y) => window.scrollTo(0, y), st.scroll);
    await page.waitForTimeout(st.wait || 900);
    await snap(st.shot || st.click || st.clickSel || (st.fill && st.fill[0]) || "step");
  } catch (e) { console.log("STEP-FAIL", JSON.stringify(st), String(e).split("\n").slice(0, 9).join(" | ").slice(0, 900)); await snap("after-fail"); }
}
if (errs.length) console.log("PAGE-ERRORS", errs.join(" | "));
await browser.close();
