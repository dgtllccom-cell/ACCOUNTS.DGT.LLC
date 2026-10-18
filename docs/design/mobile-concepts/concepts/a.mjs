// CONCEPT A — "Harbour Ledger": light, calm, trust-first. Deep-navy hero that the content slides under, brass accent, 5-tab bottom bar, menu as a bottom sheet.
import { icon, statusBar } from "../lib/core.mjs";

export const meta = { id: "a", name: "Harbour Ledger", tagline: "Light · calm · navy & brass · bottom tabs", bg: "#E9EEF6" };

export const css = `
.cA{--navy:#0E2A55;--deep:#081B3D;--brass:#C79A2B;--bg:#EEF2F8;--card:#FFFFFF;--ink:#14223B;--mut:#66768F;--line:#E1E7F0;--ok:#12906B;--warn:#D9822B;--bad:#D14B4B;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
.cA .sb{height:44px;padding:14px 24px 0;display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:600}
.cA .hero{background:linear-gradient(160deg,#0E2A55,#081B3D);color:#fff;padding:0 20px 56px;border-radius:0 0 28px 28px}
.cA .hero .sb{padding-inline:4px}
.cA .row{display:flex;align-items:center}
.cA .between{justify-content:space-between}
.cA .gap8{gap:8px}.cA .gap12{gap:12px}.cA .gap16{gap:16px}
.cA .logo{width:40px;height:40px;border-radius:12px;background:var(--brass);color:#081B3D;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
.cA .h1{font-size:24px;font-weight:700;line-height:1.25}
.cA .h2{font-size:17px;font-weight:700}
.cA .sub{font-size:13px;color:#B7C5DD}
.cA .muted{color:var(--mut);font-size:13px}
.cA .card{background:var(--card);border-radius:20px;padding:16px;box-shadow:0 6px 18px rgba(14,42,85,.08)}
.cA .lift{margin-top:-40px;padding-inline:16px;display:flex;flex-direction:column;gap:14px}
.cA .body{padding:16px;display:flex;flex-direction:column;gap:14px;flex:1}
.cA .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:600}
.cA .chip.ok{background:#DDF3EA;color:#0C7556}.cA .chip.warn{background:#FCEBD6;color:#B0620F}.cA .chip.navy{background:#E2EAF8;color:#0E2A55}.cA .chip.glass{background:rgba(255,255,255,.14);color:#fff}
.cA .field{background:#fff;border:1px solid var(--line);border-radius:14px;height:52px;display:flex;align-items:center;gap:10px;padding-inline:14px;color:var(--mut);font-size:15px}
.cA .field.tall{height:auto;min-height:52px;padding-block:14px;align-items:flex-start}
.cA .lbl{font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px}
.cA .btn{height:52px;border-radius:14px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;gap:8px}
.cA .btn.brass{background:var(--brass);color:#081B3D}
.cA .btn.line{background:#fff;color:var(--navy);border:1px solid var(--line)}
.cA .kpi{flex:1;background:var(--card);border-radius:18px;padding:14px;box-shadow:0 6px 18px rgba(14,42,85,.08);display:flex;flex-direction:column;gap:6px}
.cA .kpi b{font-size:26px;font-weight:800;line-height:1}
.cA .kpi span{font-size:12px;color:var(--mut)}
.cA .ico{width:36px;height:36px;border-radius:11px;background:#E2EAF8;color:var(--navy);display:flex;align-items:center;justify-content:center}
.cA .ico.br{background:#F6EBCB;color:#8A6410}.cA .ico.gn{background:#DDF3EA;color:#0C7556}.cA .ico.rd{background:#FBE3E3;color:#B03636}
.cA .tabs{margin-top:auto;height:84px;background:#fff;border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:10px 8px 0}
.cA .tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--mut);width:68px}
.cA .tab.on{color:var(--navy)}
.cA .tab.on .tp{background:#E2EAF8;border-radius:12px;padding:4px 14px}
.cA .tab .tp{padding:4px 14px}
.cA .bars{display:flex;align-items:flex-end;gap:10px;height:86px}
.cA .bar{flex:1;border-radius:8px 8px 4px 4px;background:#CFDAEE}
.cA .bar.on{background:var(--navy)}
.cA .li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.cA .li:last-child{border-bottom:0}
.cA .grow{flex:1;min-width:0}
.cA .sheet{background:#fff;border-radius:28px 28px 0 0;margin-top:auto;padding:12px 18px 24px;box-shadow:0 -10px 30px rgba(8,27,61,.18)}
.cA .grab{width:44px;height:5px;border-radius:3px;background:#CBD5E4;margin:0 auto 14px}
.cA .mi{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;font-weight:600;text-align:center;width:25%}
.cA .step{display:flex;gap:6px;align-items:center}
.cA .dot{width:26px;height:26px;border-radius:13px;background:#D5DEEC;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.cA .dot.on{background:var(--navy)}.cA .dot.done{background:var(--ok)}
.cA .ln{height:2px;flex:1;background:#D5DEEC}.cA .ln.on{background:var(--ok)}
.cA .tl{display:flex;gap:12px}
.cA .tlc{display:flex;flex-direction:column;align-items:center}
.cA .tld{width:14px;height:14px;border-radius:7px;background:var(--ok)}.cA .tld.idle{background:#CBD5E4}
.cA .tll{width:2px;flex:1;background:#CBD5E4;min-height:30px}
.cA .th{display:flex;padding:8px 0;font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--line)}
.cA .tr{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);font-size:13px}
.cA .rail{width:92px;background:var(--deep);color:#fff;display:flex;flex-direction:column;align-items:center;gap:20px;padding-top:56px}
.cA .rail .ri{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#9FB2D3}
.cA .rail .ri.on{background:var(--brass);color:#081B3D}
`;

const tabs = (l, S, on) => {
  const items = [["home", S.mDash], ["users", S.mCust], ["ship", S.tShip], ["chart", S.mReports], ["menu", S.more]];
  return `<div class="tabs">${items.map(([ic, t], i) => `<div class="tab ${i === on ? "on" : ""}"><div class="tp">${icon(ic, 22)}</div><span>${t}</span></div>`).join("")}</div>`;
};
const topbar = (S, title, sub, right = "") => `<div class="hero">${statusBar("#fff")}<div class="row between" style="margin-top:8px"><div class="row gap12"><div class="logo">DGT</div><div><div class="h2">${title}</div><div class="sub">${sub}</div></div></div><div class="row gap8">${right}</div></div></div>`;
const bell = `<div class="ico" style="background:rgba(255,255,255,.14);color:#fff">${icon("bell", 18)}</div>`;

export function screens(l, S) {
  const out = {};
  // 1 LOGIN
  out.login = `<div class="hero" style="padding-bottom:70px">${statusBar("#fff")}<div style="margin-top:34px" class="row gap12"><div class="logo" style="width:56px;height:56px;border-radius:16px;font-size:20px">DGT</div><div><div class="h1">${S.appB}</div><div class="sub">${S.appBsub}</div></div></div></div>
  <div class="lift"><div class="card" style="padding:22px;display:flex;flex-direction:column;gap:16px"><div class="h2">${S.signinTo}</div>
  <div><div class="lbl">${S.email}</div><div class="field">${icon("mail", 18)}<span>name@company.com</span></div></div>
  <div><div class="lbl">${S.passwordLabel}</div><div class="field">${icon("lock", 18)}<span>••••••••</span><span style="margin-inline-start:auto">${icon("eye", 18)}</span></div></div>
  <div class="btn">${S.signin}</div><div class="muted" style="text-align:center;color:var(--navy);font-weight:600">${S.forgot}</div></div>
  <div class="row gap8" style="justify-content:center"><span class="chip ok">${icon("shield", 14)}${S.approved}</span></div>
  <div class="row gap8" style="justify-content:center;flex-wrap:wrap">${["EN", "اردو", "العربية", "فارسی", "پښتو"].map((x, i) => `<span class="chip ${i === (l === "ur" ? 1 : 0) ? "navy" : ""}" style="border:1px solid var(--line);background:${i === (l === "ur" ? 1 : 0) ? "#E2EAF8" : "#fff"}">${x}</span>`).join("")}</div></div>`;
  // 2 ACTIVATION
  out.activation = `<div class="hero" style="padding-bottom:44px">${statusBar("#fff")}<div style="margin-top:20px"><div class="h1">${S.actTitle}</div><div class="sub" style="margin-top:6px;max-width:320px">${S.actSub}</div></div></div>
  <div class="lift" style="margin-top:-26px"><div class="card"><div class="step">${[[S.stRequest, 1], [S.stApproval, 2], [S.stCode, 3], [S.stSignin, 4]].map(([t, n], i) => `<div class="row gap8"><div class="dot ${i === 0 ? "on" : ""}">${n}</div></div>${i < 3 ? '<div class="ln"></div>' : ""}`).join("")}</div>
  <div class="row between" style="margin-top:8px;font-size:11px;color:var(--mut);font-weight:600"><span>${S.stRequest}</span><span>${S.stApproval}</span><span>${S.stCode}</span><span>${S.stSignin}</span></div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
   <div><div class="lbl">${S.fullName}</div><div class="field">${icon("users", 18)}</div></div>
   <div><div class="lbl">${S.mobile}</div><div class="field">${icon("phone", 18)}<span dir="ltr">+971 5X XXX XXXX</span></div></div>
   <div><div class="lbl">${S.email}</div><div class="field">${icon("mail", 18)}</div></div>
   <div><div class="lbl">${S.reviewCode}</div><div class="field">${icon("scan", 18)}<span dir="ltr">XXXX-XXXX-XXXX</span></div><div class="muted" style="margin-top:6px;font-size:11px">${S.reviewHint}</div></div>
   <div class="btn brass">${S.request}</div></div></div>`;
  // 3/4 DASHBOARDS
  const dash = (app, kpis, sub) => `${topbar(S, `${S.hello}`, `${S.role} · ${app === "B" ? S.appB : S.appBS}`, bell)}<div class="lift">
   <div class="row gap12">${kpis.slice(0, 2).map(([n, v, ic, c]) => `<div class="kpi"><div class="ico ${c}">${icon(ic, 18)}</div><b>${v}</b><span>${n}</span></div>`).join("")}</div>
   <div class="row gap12">${kpis.slice(2, 4).map(([n, v, ic, c]) => `<div class="kpi"><div class="ico ${c}">${icon(ic, 18)}</div><b>${v}</b><span>${n}</span></div>`).join("")}</div>
   <div class="card"><div class="row between"><div class="h2">${S.activity}</div><span class="chip navy">${S.live}</span></div><div class="bars" style="margin-top:14px">${[40, 62, 48, 80, 58, 90, 70].map((h, i) => `<div class="bar ${i === 5 ? "on" : ""}" style="height:${h}%"></div>`).join("")}</div></div>
   <div class="card" style="padding:6px 16px">${sub.map(([t, v, ic, c]) => `<div class="li"><div class="ico ${c}">${icon(ic, 18)}</div><div class="grow">${t}</div><b>${v}</b></div>`).join("")}</div></div>${tabs(l, S, 0)}`;
  out.dashB = dash("B", [[S.countries, "19", "globe", ""], [S.branches, "8", "anchor", "br"], [S.customers, "56", "users", "gn"], [S.users, "34", "shield", ""]], [[S.approvals, "3", "check", "br"], [S.due, "5", "task", ""], [S.messages, "2", "chat", "gn"]]);
  out.dashBS = dash("BS", [[S.assigned, "8", "box", ""], [S.pending, "7", "clock", "br"], [S.transit, "2", "ship", "gn"], [S.containers, "12", "truck", ""]], [[S.openDocs, "8", "file", "br"], [S.tasks, "4", "task", ""], [S.messages, "2", "chat", "gn"]]);
  // 5 MENU (bottom sheet over a dimmed dashboard)
  const mitems = [["home", S.mDash, ""], ["cart", S.mTrade, "br"], ["users", S.mCust, "gn"], ["ship", S.mShip, ""], ["ledger", S.mLedger, "br"], ["box", S.mStock, "gn"], ["chart", S.mReports, ""], ["task", S.mTasks, "br"], ["chat", S.mChat, "gn"], ["scan", S.mSmart, ""], ["gear", S.mSettings, "br"], ["globe", S.lang, "gn"]];
  out.menu = `<div style="filter:brightness(.55);flex:1;display:flex;flex-direction:column;pointer-events:none">${topbar(S, S.hello, S.role, bell)}<div class="lift"><div class="kpi"><b>19</b><span>${S.countries}</span></div></div></div>
  <div class="sheet" style="margin-top:-470px"><div class="grab"></div><div class="row between" style="margin-bottom:14px"><div class="h2">${S.menu}</div><div class="row gap8"><span class="chip navy">${S.role}</span></div></div>
  <div class="field" style="margin-bottom:14px">${icon("search", 18)}<span>${S.trackPh}</span></div>
  <div style="display:flex;flex-wrap:wrap;row-gap:18px">${mitems.map(([ic, t, c]) => `<div class="mi"><div class="ico ${c}" style="width:52px;height:52px;border-radius:16px">${icon(ic, 24)}</div>${t}</div>`).join("")}</div></div>`;
  // 6 CUSTOMER ORDER
  const legs = [[S.booked, 1], [S.loaded, 1], [S.border, 1], [S.customs, 0], [S.delivered, 0]];
  out.order = `${topbar(S, S.order, S.orderNo, `<span class="chip glass">${S.inClearing}</span>`)}<div class="lift">
   <div class="card"><div class="row between"><div><div class="muted">${S.customer}</div><div class="h2" style="margin-top:2px">${S.sampleCust}</div></div><div class="ico br">${icon("users", 18)}</div></div>
   <div style="margin-top:14px"><div class="muted">${S.route}</div><div style="font-weight:700;margin-top:2px">${S.uzb} → ${S.ind}</div></div><div style="margin-top:12px"><div class="muted">${S.goods}</div><div style="font-weight:700;margin-top:2px">${S.cargo}</div></div></div>
   <div class="card"><div class="h2" style="margin-bottom:12px">${S.status}</div>${legs.map(([t, d], i) => `<div class="tl"><div class="tlc"><div class="tld ${d ? "" : "idle"}"></div>${i < legs.length - 1 ? '<div class="tll"></div>' : ""}</div><div style="padding-bottom:10px;font-weight:${d ? 700 : 500};color:${d ? "var(--ink)" : "var(--mut)"}">${t}</div></div>`).join("")}</div>
   <div class="row gap12"><div class="btn brass grow" style="height:48px">${icon("plus", 18)}${S.addDoc}</div><div class="btn line" style="width:52px;height:48px">${icon("print", 20)}</div></div></div>${tabs(l, S, 2)}`;
  // 7 TRACKING
  const ev = [[S.portCall + " · " + S.nhava, "12 Nov", 0], [S.sea, "04 Nov", 1], [S.loaded + " · " + S.jebel, "29 Oct", 1]];
  out.track = `${topbar(S, S.track, S.appBS, bell)}<div class="lift"><div class="field" style="box-shadow:0 6px 18px rgba(14,42,85,.08)">${icon("search", 18)}<span>${S.trackPh}</span></div>
   <div class="card"><div class="row between"><div><div class="muted">${S.bl}</div><div class="h2" dir="ltr" style="margin-top:2px">MSCU-000000-0</div></div><span class="chip warn">${S.onSea}</span></div>
   <div class="row between" style="margin-top:16px"><div><div style="font-size:22px;font-weight:800">${S.jebel}</div><div class="muted">AE</div></div><div class="grow" style="height:2px;background:repeating-linear-gradient(90deg,#C79A2B 0 8px,transparent 8px 14px);margin:0 10px"></div><div style="text-align:end"><div style="font-size:22px;font-weight:800">${S.nhava}</div><div class="muted">IN</div></div></div>
   <div class="row between" style="margin-top:14px"><div><div class="muted">${S.vessel}</div><div style="font-weight:700">MV Sample Star</div></div><div style="text-align:end"><div class="muted">${S.eta}</div><div style="font-weight:700" dir="ltr">12 Nov 2026</div></div></div></div>
   <div class="card">${ev.map(([t, d, done], i) => `<div class="tl"><div class="tlc"><div class="tld ${done ? "" : "idle"}"></div>${i < 2 ? '<div class="tll"></div>' : ""}</div><div class="row between grow" style="padding-bottom:12px"><span style="font-weight:600">${t}</span><span class="muted" dir="ltr">${d}</span></div></div>`).join("")}</div></div>${tabs(l, S, 2)}`;
  // 8 REPORT
  out.report = `${topbar(S, S.report, S.thisMonth, `<div class="ico" style="background:rgba(255,255,255,.14);color:#fff">${icon("down", 18)}</div>`)}<div class="lift">
   <div class="row gap12"><div class="kpi"><b>8</b><span>${S.total}</span></div><div class="kpi"><b style="color:var(--warn)">2</b><span>${S.onSea}</span></div><div class="kpi"><b style="color:var(--ok)">5</b><span>${S.cleared}</span></div></div>
   <div class="row gap8">${[S.all, S.onSea, S.arrived, S.cleared].map((t, i) => `<span class="chip ${i === 0 ? "navy" : ""}" style="${i ? "background:#fff;border:1px solid var(--line)" : ""}">${t}</span>`).join("")}</div>
   <div class="card" style="padding:6px 16px"><div class="th"><span style="width:44%">${S.bl}</span><span style="width:32%">${S.vessel}</span><span style="width:24%;text-align:end">${S.status}</span></div>
   ${[["MSCU-000001", "MV Sample Star", S.onSea, "warn"], ["MSCU-000002", "MV Sample Star", S.arrived, "navy"], ["MSCU-000003", "MV Sample Moon", S.cleared, "ok"], ["MSCU-000004", "MV Sample Moon", S.cleared, "ok"]].map(([a, b, c, k]) => `<div class="tr"><span style="width:44%;font-weight:700" dir="ltr">${a}</span><span style="width:32%;color:var(--mut)" dir="ltr">${b}</span><span style="width:24%;text-align:end"><span class="chip ${k}" style="padding:3px 9px;font-size:11px">${c}</span></span></div>`).join("")}</div>
   <div class="row gap12"><div class="btn line grow" style="height:46px">${icon("print", 18)}${S.print}</div><div class="btn grow" style="height:46px">${icon("down", 18)}${S.export}</div></div></div>${tabs(l, S, 3)}`;
  return out;
}

// tablet (834×1112): navy rail + two-pane content
export function tablets(l, S) {
  const t = {};
  const rail = (on) => `<div class="rail">${statusBar("#fff").replace('class="sb"', 'class="sb" style="display:none"')}<div class="logo">DGT</div>${["home", "users", "ship", "chart", "gear"].map((ic, i) => `<div class="ri ${i === on ? "on" : ""}">${icon(ic, 24)}</div>`).join("")}</div>`;
  t.dashTab = `<div style="display:flex;flex:1">${rail(0)}<div style="flex:1;display:flex;flex-direction:column">${topbar(S, S.hello, `${S.role} · ${S.appBS}`, bell)}<div class="lift" style="padding-inline:24px">
    <div class="row gap12">${[[S.assigned, "8", "box", ""], [S.pending, "7", "clock", "br"], [S.transit, "2", "ship", "gn"], [S.containers, "12", "truck", ""]].map(([n, v, ic, c]) => `<div class="kpi"><div class="ico ${c}">${icon(ic, 18)}</div><b>${v}</b><span>${n}</span></div>`).join("")}</div>
    <div class="row gap12" style="align-items:stretch"><div class="card grow" style="flex:1.4"><div class="row between"><div class="h2">${S.activity}</div><span class="chip navy">${S.live}</span></div><div class="bars" style="margin-top:14px;height:170px">${[40, 62, 48, 80, 58, 90, 70, 55, 66, 74].map((h, i) => `<div class="bar ${i === 5 ? "on" : ""}" style="height:${h}%"></div>`).join("")}</div></div>
    <div class="card grow" style="padding:6px 16px">${[[S.openDocs, "8", "file", "br"], [S.tasks, "4", "task", ""], [S.messages, "2", "chat", "gn"]].map(([a, v, ic, c]) => `<div class="li"><div class="ico ${c}">${icon(ic, 18)}</div><div class="grow">${a}</div><b>${v}</b></div>`).join("")}</div></div>
    <div class="card" style="padding:6px 20px"><div class="row between" style="padding:12px 0"><div class="h2">${S.report}</div><span class="chip navy">${S.thisMonth}</span></div><div class="th"><span style="width:34%">${S.bl}</span><span style="width:34%">${S.vessel}</span><span style="width:32%;text-align:end">${S.status}</span></div>${[["MSCU-000001", "MV Sample Star", S.onSea, "warn"], ["MSCU-000002", "MV Sample Star", S.arrived, "navy"], ["MSCU-000003", "MV Sample Moon", S.cleared, "ok"], ["MSCU-000004", "MV Sample Moon", S.cleared, "ok"], ["MSCU-000005", "MV Sample Sun", S.cleared, "ok"]].map(([x, y, z, k]) => `<div class="tr"><span style="width:34%;font-weight:700" dir="ltr">${x}</span><span style="width:34%;color:var(--mut)" dir="ltr">${y}</span><span style="width:32%;text-align:end"><span class="chip ${k}" style="padding:3px 9px;font-size:11px">${z}</span></span></div>`).join("")}</div></div></div></div>`;
  t.trackTab = `<div style="display:flex;flex:1">${rail(2)}<div style="flex:1;display:flex;flex-direction:column">${topbar(S, S.track, S.appBS, bell)}<div class="lift" style="padding-inline:24px"><div class="field">${icon("search", 18)}<span>${S.trackPh}</span></div>
    <div class="row gap12" style="align-items:stretch"><div class="card" style="width:300px;padding:6px 16px">${[["MSCU-000001", S.onSea, "warn"], ["MSCU-000002", S.arrived, "navy"], ["MSCU-000003", S.cleared, "ok"], ["MSCU-000004", S.cleared, "ok"]].map(([a, b, k], i) => `<div class="li" style="${i === 0 ? "background:#EEF2F8;margin:0 -16px;padding-inline:16px" : ""}"><div class="grow" style="font-weight:700" dir="ltr">${a}</div><span class="chip ${k}" style="padding:3px 9px;font-size:11px">${b}</span></div>`).join("")}</div>
    <div class="card grow"><div class="row between"><div class="h2" dir="ltr">MSCU-000001</div><span class="chip warn">${S.onSea}</span></div><div class="row between" style="margin-top:22px"><div style="font-size:26px;font-weight:800">${S.jebel}</div><div class="grow" style="height:2px;background:repeating-linear-gradient(90deg,#C79A2B 0 8px,transparent 8px 14px);margin:0 14px"></div><div style="font-size:26px;font-weight:800">${S.nhava}</div></div>
    <div style="margin-top:26px">${[[S.portCall + " · " + S.nhava, "12 Nov", 0], [S.sea, "04 Nov", 1], [S.loaded + " · " + S.jebel, "29 Oct", 1]].map(([x, d, done], i) => `<div class="tl"><div class="tlc"><div class="tld ${done ? "" : "idle"}"></div>${i < 2 ? '<div class="tll"></div>' : ""}</div><div class="row between grow" style="padding-bottom:12px"><span style="font-weight:600">${x}</span><span class="muted" dir="ltr">${d}</span></div></div>`).join("")}</div></div></div></div></div></div>`;
  return t;
}
