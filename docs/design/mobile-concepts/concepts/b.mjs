// CONCEPT B — "Night Dock": dark-first control room. KPI rail, status rings, floating pill navigation, launcher-grid menu. Teal + amber on deep navy.
import { icon, statusBar } from "../lib/core.mjs";

export const meta = { id: "b", name: "Night Dock", tagline: "Dark-first · control-room · teal & amber · floating nav", bg: "#060D19", ink: "#E8EEF8", sub: "#8A9BB8" };

export const css = `
.cB{--bg:#0A1424;--sf:#111E33;--sf2:#16263F;--bd:#223350;--ink:#E8EEF8;--mut:#8A9BB8;--teal:#1ED2B7;--amb:#F5B544;--red:#FF6B6B;--blu:#5B9DFF;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;position:relative}
.cB .sb{height:44px;padding:14px 24px 0;display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:600;color:#fff}
.cB .row{display:flex;align-items:center}.cB .between{justify-content:space-between}.cB .g8{gap:8px}.cB .g12{gap:12px}.cB .g16{gap:16px}
.cB .pad{padding:0 20px}
.cB .col{display:flex;flex-direction:column}
.cB .h1{font-size:28px;font-weight:800;letter-spacing:-.4px;line-height:1.2}.cB .h2{font-size:16px;font-weight:700}
.cB .mut{color:var(--mut);font-size:12px}.cB .cap{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.cB .av{width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,#1ED2B7,#5B9DFF);color:#06202A;font-weight:800;display:flex;align-items:center;justify-content:center}
.cB .ib{width:42px;height:42px;border-radius:14px;background:var(--sf);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--ink)}
.cB .card{background:var(--sf);border:1px solid var(--bd);border-radius:22px;padding:16px}
.cB .rail{display:flex;gap:12px;padding:0 20px;overflow:hidden}
.cB .tile{width:148px;flex:none;background:linear-gradient(160deg,#16263F,#101C31);border:1px solid var(--bd);border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:10px}
.cB .tile b{font-size:34px;font-weight:800;line-height:1}
.cB .tile.hot{background:linear-gradient(160deg,#128F7E,#0C5E69);border-color:#1ED2B7}
.cB .tile.hot .mut{color:#C8F4EE}
.cB .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:700}
.cB .pill.t{background:rgba(30,210,183,.14);color:var(--teal)}.cB .pill.a{background:rgba(245,181,68,.14);color:var(--amb)}.cB .pill.b{background:rgba(91,157,255,.16);color:var(--blu)}.cB .pill.r{background:rgba(255,107,107,.14);color:var(--red)}
.cB .field{background:var(--sf);border:1px solid var(--bd);border-radius:16px;height:54px;display:flex;align-items:center;gap:12px;padding-inline:16px;color:var(--mut);font-size:15px}
.cB .lbl{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);margin-bottom:8px}
.cB .btn{height:54px;border-radius:16px;background:linear-gradient(90deg,#1ED2B7,#35E0C2);color:#05222B;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;gap:8px}
.cB .btn.gh{background:var(--sf);color:var(--ink);border:1px solid var(--bd)}
.cB .nav{position:absolute;bottom:22px;left:50%;margin-left:-168px;width:336px;height:68px;border-radius:34px;background:rgba(22,38,63,.96);border:1px solid #2C4266;display:flex;align-items:center;justify-content:space-around;padding:0 10px}
.cB .ni{width:46px;height:46px;border-radius:23px;display:flex;align-items:center;justify-content:center;color:var(--mut)}
.cB .ni.on{background:var(--teal);color:#05222B}
.cB .fab{width:54px;height:54px;border-radius:27px;background:var(--amb);color:#2A1C00;display:flex;align-items:center;justify-content:center}
.cB .li{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--bd)}.cB .li:last-child{border-bottom:0}
.cB .grow{flex:1;min-width:0}
.cB .bars{display:flex;align-items:flex-end;gap:8px;height:96px}
.cB .bar{flex:1;border-radius:6px;background:#1F3354}.cB .bar.on{background:linear-gradient(180deg,#1ED2B7,#128F7E)}
.cB .orb{position:absolute;border-radius:50%}
.cB .lt{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px}
.cB .lc{background:var(--sf);border:1px solid var(--bd);border-radius:22px;padding:14px;height:104px;display:flex;flex-direction:column;justify-content:space-between;font-weight:700;font-size:14px}
.cB .lc .ib2{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.cB .seg{display:flex;background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:4px}
.cB .seg span{flex:1;text-align:center;padding:8px 0;border-radius:10px;font-size:12px;font-weight:700;color:var(--mut)}.cB .seg span.on{background:var(--sf2);color:var(--ink)}
.cB .trk{height:6px;border-radius:3px;background:#223350;position:relative;flex:1}
.cB .trk i{display:block;height:6px;border-radius:3px;background:linear-gradient(90deg,#1ED2B7,#5B9DFF);width:62%}
.cB .th{display:flex;padding:10px 0;font-size:10px;font-weight:700;letter-spacing:.7px;color:var(--mut);text-transform:uppercase;border-bottom:1px solid var(--bd)}
.cB .tr{display:flex;align-items:center;padding:13px 0;border-bottom:1px solid var(--bd);font-size:13px}
.cB .top{background:var(--sf);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:16px;padding:14px 28px}
.cB .step{display:flex;gap:12px}.cB .sdot{width:28px;height:28px;border-radius:14px;background:var(--sf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--mut)}
.cB .sdot.on{background:var(--teal);color:#05222B;border-color:var(--teal)}.cB .sdot.done{background:rgba(30,210,183,.2);color:var(--teal);border-color:var(--teal)}
`;

const nav = (on) => `<div class="nav">${["home", "users", "ship"].map((ic, i) => `<div class="ni ${i === on ? "on" : ""}">${icon(ic, 22)}</div>`).join("")}<div class="fab">${icon("plus", 26, 2.4)}</div>${["chart", "menu"].map((ic, i) => `<div class="ni ${on === 3 + i ? "on" : ""}">${icon(ic, 22)}</div>`).join("")}</div>`;
const head = (S, title, sub, right = "") => `${statusBar("#fff")}<div class="pad row between" style="margin:10px 0 18px"><div class="row g12"><div class="av">SA</div><div><div class="h2">${title}</div><div class="mut">${sub}</div></div></div><div class="row g8">${right}<div class="ib">${icon("bell", 18)}</div></div></div>`;
const ring = (pct, col, label, val) => `<div class="col" style="align-items:center;gap:8px"><div style="position:relative;width:84px;height:84px"><svg width="84" height="84" viewBox="0 0 84 84" style="position:absolute;left:0;top:0"><circle cx="42" cy="42" r="34" fill="none" stroke="#223350" stroke-width="9"/><circle cx="42" cy="42" r="34" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 34 * pct).toFixed(0)} 400" transform="rotate(-90 42 42)"/></svg><div style="position:absolute;left:0;top:0;width:84px;height:84px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px">${val}</div></div><div class="mut" style="text-align:center">${label}</div></div>`;

export function screens(l, S) {
  const o = {};
  o.login = `<div class="orb" style="left:-90px;top:-80px;width:320px;height:320px;background:rgba(30,210,183,.10)"></div><div class="orb" style="left:-40px;top:-30px;width:220px;height:220px;background:rgba(30,210,183,.12)"></div><div class="orb" style="right:-120px;top:240px;width:300px;height:300px;background:rgba(91,157,255,.08)"></div>
  ${statusBar("#fff")}<div class="pad col" style="margin-top:56px;gap:10px;position:relative"><div class="av" style="width:60px;height:60px;border-radius:20px;font-size:20px">DGT</div><div class="h1" style="margin-top:14px">${S.appB}</div><div class="mut" style="font-size:14px">${S.signinTo}</div></div>
  <div class="pad col" style="margin-top:34px;gap:16px;position:relative"><div><div class="lbl">${S.email}</div><div class="field">${icon("mail", 18)}<span>name@company.com</span></div></div><div><div class="lbl">${S.passwordLabel}</div><div class="field">${icon("lock", 18)}<span>••••••••</span></div></div><div class="btn">${S.signin}</div>
  <div class="row between"><span class="pill t">${icon("shield", 14)}${S.approved}</span><span class="mut" style="color:var(--teal);font-weight:700">${S.forgot}</span></div></div>
  <div class="pad row g8" style="margin-top:auto;padding-bottom:34px;justify-content:center;flex-wrap:wrap">${["EN", "اردو", "العربية", "فارسی", "پښتو"].map((x, i) => `<span class="pill ${i === (l === "ur" ? 1 : 0) ? "t" : ""}" style="${i === (l === "ur" ? 1 : 0) ? "" : "background:var(--sf);color:var(--mut)"}">${x}</span>`).join("")}</div>`;
  o.activation = `${statusBar("#fff")}<div class="pad col" style="margin-top:20px;gap:8px"><div class="cap" style="color:var(--teal)">${S.appB}</div><div class="h1">${S.actTitle}</div><div class="mut" style="font-size:14px;line-height:1.5">${S.actSub}</div></div>
  <div class="pad row g8" style="margin-top:20px">${[S.stRequest, S.stApproval, S.stCode, S.stSignin].map((t, i) => `<div class="grow col g8"><div style="height:5px;border-radius:3px;background:${i === 0 ? "var(--teal)" : "#223350"}"></div><span class="mut" style="font-weight:${i === 0 ? 700 : 500};color:${i === 0 ? "var(--teal)" : "var(--mut)"}">${t}</span></div>`).join("")}</div>
  <div class="pad col" style="margin-top:22px;gap:14px"><div><div class="lbl">${S.fullName}</div><div class="field">${icon("users", 18)}</div></div><div><div class="lbl">${S.mobile}</div><div class="field">${icon("phone", 18)}<span dir="ltr">+971 5X XXX XXXX</span></div></div><div><div class="lbl">${S.email}</div><div class="field">${icon("mail", 18)}</div></div>
  <div><div class="lbl">${S.reviewCode}</div><div class="field" style="border-style:dashed">${icon("scan", 18)}<span dir="ltr">XXXX-XXXX-XXXX</span></div></div></div>
  <div class="pad" style="margin-top:auto;padding-bottom:34px"><div class="btn">${S.request}</div></div>`;
  const dash = (kp, rings, list) => `${head(S, `${S.hello}`, `${S.role}`)}
   <div class="rail">${kp.map(([n, v, ic, hot]) => `<div class="tile ${hot ? "hot" : ""}"><div class="row between"><span class="mut">${n}</span><span style="color:${hot ? "#fff" : "var(--teal)"}">${icon(ic, 18)}</span></div><b>${v}</b></div>`).join("")}</div>
   <div class="pad" style="margin-top:16px"><div class="card"><div class="row between" style="margin-bottom:14px"><div class="h2">${S.activity}</div><span class="pill t">${S.live}</span></div><div class="row between" style="padding:0 6px">${rings}</div></div></div>
   <div class="pad" style="margin-top:14px"><div class="card" style="padding:4px 16px">${list.map(([t, v, ic, c]) => `<div class="li"><span class="pill ${c}" style="padding:8px">${icon(ic, 16)}</span><div class="grow">${t}</div><b>${v}</b></div>`).join("")}</div></div>${nav(0)}`;
  o.dashB = dash([[S.countries, "19", "globe", true], [S.branches, "8", "anchor"], [S.customers, "56", "users"], [S.users, "34", "shield"]], ring(0.72, "#1ED2B7", S.purchases, "72%") + ring(0.45, "#F5B544", S.approvals, "45%") + ring(0.88, "#5B9DFF", S.tasks, "88%"), [[S.approvals, "3", "check", "a"], [S.due, "5", "task", "b"], [S.messages, "2", "chat", "t"]]);
  o.dashBS = dash([[S.assigned, "8", "box", true], [S.pending, "7", "clock"], [S.transit, "2", "ship"], [S.containers, "12", "truck"]], ring(0.62, "#1ED2B7", S.cleared, "62%") + ring(0.28, "#F5B544", S.pending, "28%") + ring(0.5, "#5B9DFF", S.transit, "50%"), [[S.openDocs, "8", "file", "a"], [S.tasks, "4", "task", "b"], [S.messages, "2", "chat", "t"]]);
  const it = [["home", S.mDash, "t"], ["scan", S.mSmart, "a"], ["users", S.mCust, "b"], ["cart", S.mTrade, "t"], ["ship", S.mShip, "a"], ["ledger", S.mLedger, "b"], ["box", S.mStock, "t"], ["chart", S.mReports, "a"], ["task", S.mTasks, "b"], ["chat", S.mChat, "t"]];
  const tc = { t: "rgba(30,210,183,.14);color:#1ED2B7", a: "rgba(245,181,68,.14);color:#F5B544", b: "rgba(91,157,255,.16);color:#5B9DFF" };
  o.menu = `${statusBar("#fff")}<div class="pad row between" style="margin:10px 0 16px"><div class="h1" style="font-size:26px">${S.menu}</div><div class="ib">${icon("search", 18)}</div></div>
   <div class="lt">${it.map(([ic, t, c]) => `<div class="lc"><div class="ib2" style="background:${tc[c]}">${icon(ic, 22)}</div><span>${t}</span></div>`).join("")}</div>
   <div class="pad row between" style="margin-top:auto;padding-bottom:34px"><div class="row g12"><div class="av">SA</div><div><div class="h2">${S.role}</div><div class="mut">${S.appB}</div></div></div><div class="seg" style="width:140px"><span class="on">EN</span><span>اردو</span></div></div>`;
  const legs = [[S.booked, 1], [S.loaded, 1], [S.border, 1], [S.customs, 0], [S.delivered, 0]];
  o.order = `${head(S, S.order, S.orderNo, `<span class="pill a">${S.inClearing}</span>`)}
   <div class="pad col" style="gap:14px"><div class="card col" style="gap:14px"><div class="row between"><div><div class="cap">${S.customer}</div><div class="h2" style="margin-top:4px">${S.sampleCust}</div></div><div class="ib">${icon("users", 18)}</div></div>
   <div class="row g12"><div class="grow"><div class="cap">${S.route}</div><div style="font-weight:700;margin-top:4px">${S.uzb} → ${S.ind}</div></div></div><div><div class="cap">${S.goods}</div><div style="font-weight:700;margin-top:4px">${S.cargo}</div></div></div>
   <div class="card"><div class="row" style="gap:6px">${legs.map(([t, d]) => `<div class="grow col g8" style="align-items:center"><div class="sdot ${d ? "done" : ""}">${d ? icon("check", 14, 2.6) : ""}</div><span class="mut" style="font-size:10px;font-weight:${d ? 700 : 500};color:${d ? "var(--teal)" : "var(--mut)"}">${t}</span></div>`).join("")}</div></div>
   <div class="row g12"><div class="btn grow" style="height:50px">${icon("plus", 18, 2.4)}${S.addDoc}</div><div class="btn gh" style="width:54px;height:50px">${icon("print", 20)}</div></div></div>${nav(2)}`;
  o.track = `${head(S, S.track, S.appBS)}<div class="pad col" style="gap:14px"><div class="field">${icon("search", 18)}<span>${S.trackPh}</span></div>
   <div class="card col" style="gap:16px"><div class="row between"><div><div class="cap">${S.bl}</div><div class="h2" dir="ltr" style="margin-top:4px;font-size:20px">MSCU-000000-0</div></div><span class="pill a">${S.onSea}</span></div>
   <div class="row g12"><div class="col"><b style="font-size:20px">${S.jebel}</b><span class="mut">AE</span></div><div class="trk"><i></i></div><div class="col" style="text-align:end"><b style="font-size:20px">${S.nhava}</b><span class="mut">IN</span></div></div>
   <div class="row between"><div><div class="cap">${S.vessel}</div><div style="font-weight:700;margin-top:3px">MV Sample Star</div></div><div style="text-align:end"><div class="cap">${S.eta}</div><div style="font-weight:700;margin-top:3px" dir="ltr">12 Nov 2026</div></div></div></div>
   <div class="card" style="padding:4px 16px">${[[S.portCall + " · " + S.nhava, "12 Nov", "r"], [S.sea, "04 Nov", "t"], [S.loaded + " · " + S.jebel, "29 Oct", "t"]].map(([a, d, c]) => `<div class="li"><span class="pill ${c === "r" ? "a" : "t"}" style="padding:7px">${icon(c === "r" ? "clock" : "check", 14, 2.4)}</span><div class="grow" style="font-weight:600">${a}</div><span class="mut" dir="ltr">${d}</span></div>`).join("")}</div></div>${nav(2)}`;
  o.report = `${head(S, S.report, S.thisMonth, `<div class="ib">${icon("down", 18)}</div>`)}<div class="pad col" style="gap:14px"><div class="row g12">${[["8", S.total, ""], ["2", S.onSea, "a"], ["5", S.cleared, "t"]].map(([v, t, c]) => `<div class="card grow" style="padding:14px"><b style="font-size:30px;color:${c === "a" ? "var(--amb)" : c === "t" ? "var(--teal)" : "var(--ink)"}">${v}</b><div class="mut" style="margin-top:4px">${t}</div></div>`).join("")}</div>
   <div class="seg">${[S.all, S.onSea, S.arrived, S.cleared].map((t, i) => `<span class="${i === 0 ? "on" : ""}">${t}</span>`).join("")}</div>
   <div class="card" style="padding:4px 16px"><div class="th"><span style="width:44%">${S.bl}</span><span style="width:30%">${S.vessel}</span><span style="width:26%;text-align:end">${S.status}</span></div>${[["MSCU-000001", "MV Sample Star", S.onSea, "a"], ["MSCU-000002", "MV Sample Star", S.arrived, "b"], ["MSCU-000003", "MV Sample Moon", S.cleared, "t"], ["MSCU-000004", "MV Sample Moon", S.cleared, "t"]].map(([a, b, c, k]) => `<div class="tr"><span style="width:44%;font-weight:700" dir="ltr">${a}</span><span style="width:30%;color:var(--mut)" dir="ltr">${b}</span><span style="width:26%;text-align:end"><span class="pill ${k}" style="padding:3px 9px;font-size:11px">${c}</span></span></div>`).join("")}</div>
   <div class="row g12"><div class="btn gh grow" style="height:48px">${icon("print", 18)}${S.print}</div><div class="btn grow" style="height:48px">${icon("down", 18)}${S.export}</div></div></div>${nav(3)}`;
  return o;
}

export function tablets(l, S) {
  const t = {};
  const top = (on) => `${statusBar("#fff")}<div class="top"><div class="av">SA</div><div class="grow"><div class="h2">${S.appBS}</div><div class="mut">${S.role}</div></div><div class="row g8">${["home", "users", "ship", "chart", "menu"].map((ic, i) => `<div class="ni ${i === on ? "on" : ""}">${icon(ic, 22)}</div>`).join("")}</div><div class="ib">${icon("bell", 18)}</div></div>`;
  t.dashTab = `${top(0)}<div class="pad col" style="padding:24px 28px;gap:18px"><div class="row g12">${[[S.assigned, "8", "box", true], [S.pending, "7", "clock"], [S.transit, "2", "ship"], [S.containers, "12", "truck"]].map(([n, v, ic, hot]) => `<div class="tile grow ${hot ? "hot" : ""}" style="width:auto"><div class="row between"><span class="mut">${n}</span><span style="color:${hot ? "#fff" : "var(--teal)"}">${icon(ic, 18)}</span></div><b>${v}</b></div>`).join("")}</div>
   <div class="row g12" style="align-items:stretch"><div class="card grow" style="flex:1.3"><div class="row between"><div class="h2">${S.activity}</div><span class="pill t">${S.live}</span></div><div class="bars" style="height:190px;margin-top:18px">${[40, 62, 48, 80, 58, 90, 70, 55, 66, 74, 52, 84].map((h, i) => `<div class="bar ${i === 5 ? "on" : ""}" style="height:${h}%"></div>`).join("")}</div></div>
   <div class="card grow row" style="justify-content:space-around">${ring(0.62, "#1ED2B7", S.cleared, "62%")}${ring(0.28, "#F5B544", S.pending, "28%")}</div></div>
   <div class="card" style="padding:4px 20px"><div class="th"><span style="width:34%">${S.bl}</span><span style="width:34%">${S.vessel}</span><span style="width:32%;text-align:end">${S.status}</span></div>${[["MSCU-000001", "MV Sample Star", S.onSea, "a"], ["MSCU-000002", "MV Sample Star", S.arrived, "b"], ["MSCU-000003", "MV Sample Moon", S.cleared, "t"], ["MSCU-000004", "MV Sample Moon", S.cleared, "t"], ["MSCU-000005", "MV Sample Sun", S.cleared, "t"]].map(([a, b, c, k]) => `<div class="tr"><span style="width:34%;font-weight:700" dir="ltr">${a}</span><span style="width:34%;color:var(--mut)" dir="ltr">${b}</span><span style="width:32%;text-align:end"><span class="pill ${k}" style="padding:3px 9px;font-size:11px">${c}</span></span></div>`).join("")}</div></div>`;
  t.trackTab = `${top(2)}<div class="pad col" style="padding:24px 28px;gap:16px"><div class="field">${icon("search", 18)}<span>${S.trackPh}</span></div><div class="row g12" style="align-items:stretch"><div class="card" style="width:290px;padding:4px 16px">${[["MSCU-000001", S.onSea, "a"], ["MSCU-000002", S.arrived, "b"], ["MSCU-000003", S.cleared, "t"], ["MSCU-000004", S.cleared, "t"]].map(([a, b, k], i) => `<div class="li" style="${i === 0 ? "background:#16263F;margin:0 -16px;padding-inline:16px;border-radius:14px" : ""}"><div class="grow" style="font-weight:700" dir="ltr">${a}</div><span class="pill ${k}" style="padding:3px 9px;font-size:11px">${b}</span></div>`).join("")}</div>
   <div class="card grow col" style="gap:20px"><div class="row between"><div class="h2" dir="ltr" style="font-size:22px">MSCU-000001</div><span class="pill a">${S.onSea}</span></div><div class="row g12"><b style="font-size:26px">${S.jebel}</b><div class="trk"><i></i></div><b style="font-size:26px">${S.nhava}</b></div>
   ${[[S.portCall + " · " + S.nhava, "12 Nov", "r"], [S.sea, "04 Nov", "t"], [S.loaded + " · " + S.jebel, "29 Oct", "t"]].map(([a, d, c]) => `<div class="li"><span class="pill ${c === "r" ? "a" : "t"}" style="padding:7px">${icon(c === "r" ? "clock" : "check", 14, 2.4)}</span><div class="grow" style="font-weight:600">${a}</div><span class="mut" dir="ltr">${d}</span></div>`).join("")}</div></div></div>`;
  return t;
}
