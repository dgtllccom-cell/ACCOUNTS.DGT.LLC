/**
 * Screen specification for the DGT.llc B / BS design set.
 * Content source = the REAL ERP: routes are checked against app/**\/page.tsx at build time; every visible label is an English string that must
 * resolve to a real translation (ERP dictionaries lib/i18n/ui.ts, table headers, login translations). No business data anywhere.
 *   K('mdev.title')  -> English text of a ui.ts key (its 5 translations are registered automatically)
 *   L('signInSecurely') -> English text of a login-translations.ts field
 * Anything written as a plain English label must exist in the ERP dictionaries, or the build fails and lists it.
 */
export function buildSpec(K, L) {
  const groups = {
    access: { title: "1 · Login & device activation / approval", note: "Both apps. The device gate (/auth/device) comes BEFORE login; the Super Admin approves phones in the ERP (Mobile Devices)." },
    dash: { title: "2 · Dashboards — Business (B) and Shipping (BS)", note: "3D-style elements: tinted-edge KPI tiles, gem icon chips, isometric hero art, depth bars. Values are placeholders (#,###) — real figures come from live ERP data only." },
    nav: { title: "3 · Navigation — drawer menus per role, More tab", note: "Menu content = the real sidebar (components/layout/digital-dock-premium-sidebar.tsx), filtered by role and operational domain exactly as the web ERP does." },
    biz: { title: "4 · Business modules — purchase, sales, stock", note: "B app. Existing screens re-laid-out for touch; no new modules, no changed workflows." },
    ship: { title: "5 · Shipping, tracking, customer orders & clearing", note: "BS app (Operations Admins with domain 'both' also see these in B). Tablet shows master-detail." },
    acct: { title: "6 · Accounts & reports", note: "Ledger, Roznamcha, reports hub and the universal report preview (print / PDF / export)." },
    notif: { title: "7 · Notifications, approvals & tasks", note: "The ERP has no separate notification centre: the surfaces are Transfer & Handover Center, Smart Operations and User Tasks. Native push is NOT built (needs Firebase/APNs) — flagged in README." },
    set: { title: "8 · Settings & profile", note: "Profile, language (5, with RTL), appearance. Language persists across refresh/navigation (erp_lang)." },
    states: { title: "9 · System states", note: "Empty / loading / error / offline — same patterns everywhere." }
  };

  const S = [];
  const add = (s) => S.push(Object.assign({ apps: ["b", "bs"], nav: 0 }, s));

  // ───────────────────────── 1. access ─────────────────────────
  add({ id: "a1", group: "access", layout: "splash", routes: ["(native splash)"], note: "Native splash in the app's own colour (B #0f3ea8, BS #0a2a4f), icon centred, ≤1.5 s." });
  add({ id: "a2", group: "access", layout: "center", routes: ["/auth/device"], brandTitle: K("mdev.title"), sub: K("mdev.subtitle"), blocks: [
    { k: "form", fields: [{ l: K("mdev.name") }, { l: K("mdev.phone") }, { l: K("mdev.identifier"), hint: K("mdev.identifier_hint") }, { l: K("mdev.note"), t: "textarea" }, { l: K("mdev.review_code"), hint: K("mdev.review_code_hint") }], actions: [{ l: K("mdev.submit"), v: "p", i: "device" }] }] , note: "Device activation request. The review-code field is only for store reviewers (review pass)." });
  add({ id: "a3", group: "access", layout: "center", routes: ["/auth/device"], brandTitle: K("mdev.pending_title"), blocks: [
    { k: "state", kind: "loading", title: K("mdev.pending_title"), text: K("mdev.pending_body"), action: K("mdev.check_now") }], note: "State: pending. Polls status; no login possible yet." });
  add({ id: "a4", group: "access", layout: "center", routes: ["/auth/device"], brandTitle: K("mdev.approved_title"), sub: K("mdev.approved_body"), blocks: [
    { k: "otp" }, { k: "actions", items: [{ l: K("mdev.activate"), v: "p", i: "shield" }] }, { k: "notice", tone: "warn", text: K("mdev.attempts_left") }], note: "State: approved. 6-digit code, always LTR; lock after repeated wrong codes." });
  add({ id: "a5", group: "access", layout: "center", routes: ["/auth/login"], brandTitle: L("brandTitle"), sub: L("brandSubtitle"), blocks: [
    { k: "form", fields: [{ l: L("identifierPlaceholder") }, { l: L("passwordPlaceholder"), t: "pass" }], actions: [{ l: L("signInSecurely"), v: "p", i: "shield" }] },
    { k: "actions", items: [{ l: L("forgotPassword"), v: "g" }] }], note: "Login. The stub 'Face ID / Fingerprint' button is hidden in the apps (it never signed in); a real biometric unlock is a flagged future change." });
  add({ id: "a6", group: "access", layout: "center", routes: ["/auth/app-access"], brandTitle: K("appch.title"), blocks: [
    { k: "notice", tone: "warn", text: K("appch.body_b") }, { k: "notice", tone: "info", text: K("appch.contact") }, { k: "actions", items: [{ l: K("appch.sign_out"), v: "s", i: "logout" }] }], note: "Wrong-app notice: a shipping-only login opened in B (and vice-versa) is told which app to use." });
  add({ id: "a7", group: "access", title: K("mdev.adm_title"), nav: 4, routes: ["/dashboard/super-admin/mobile-devices"], note: "Super Admin approves phones. Tablet-first (table); phone shows cards.", blocks: [
    { k: "seg", items: [K("mdev.f_all"), K("mdev.st_pending"), K("mdev.st_approved"), K("mdev.st_active"), K("mdev.st_revoked")] },
    { k: "table", cols: [K("mdev.col_person"), K("mdev.col_login"), K("mdev.col_app"), K("mdev.col_device"), K("mdev.col_requested")], rows: 5, status: [[K("mdev.st_pending"), "warn"], [K("mdev.st_active"), "ok"], [K("mdev.st_revoked"), "bad"]], actions: ["check", "x", "lock"], span: "full" },
    { k: "card", title: K("mdev.rp_title"), icon: "shield", span: "half", body: [
      { k: "form", fields: [{ l: K("mdev.rp_name") }, { l: K("mdev.rp_identifier") }, { l: K("mdev.rp_days") }, { l: K("mdev.rp_max") }], actions: [{ l: K("mdev.rp_create"), v: "p", i: "plus" }] }] }] });

  // ───────────────────────── 2. dashboards ─────────────────────────
  add({ id: "d1", group: "dash", apps: ["b"], title: "Dashboard", routes: ["/dashboard/super-admin"], blocks: [
    { k: "hero", title: K("dash.financial_overview_live"), sub: K("dash.live_db_overview_subtitle"), art: "ledger" },
    { k: "kpis", items: [{ l: K("dash.total_sales"), icon: "chart", tone: "green" }, { l: K("dash.total_purchase"), icon: "cart", tone: "primary" }, { l: K("dash.total_receivables"), icon: "wallet", tone: "amber" }, { l: K("dash.total_payables"), icon: "money", tone: "red" }] },
    { k: "chart", title: K("dash.sales_vs_purchase"), span: "half" },
    { k: "list", title: K("dash.pending_approvals"), n: 3, fields: ["Date", "Amount"], status: [["Pending", "warn"]], icon: "clock", tone: "amber", span: "half" },
    { k: "sec", title: K("dash.quick_actions") },
    { k: "qa", items: [{ l: "New Purchase Booking Order", icon: "cart", tone: "primary" }, { l: "New Sales Booking Order", icon: "tag", tone: "green" }, { l: "Daily Cash Entry (Roznamcha)", icon: "money", tone: "amber" }, { l: "Reports", icon: "chart", tone: "violet" }] }] });
  add({ id: "d2", group: "dash", apps: ["b"], title: "Dashboard", routes: ["/dashboard/country", "/dashboard/city"], note: "Country / branch role dashboards: same layout, scoped by country/branch (server-enforced).", blocks: [
    { k: "kpis", items: [{ l: K("dash.total_sales"), icon: "chart", tone: "green" }, { l: K("dash.total_purchase"), icon: "cart", tone: "primary" }, { l: K("dash.ledger_balance"), icon: "book", tone: "teal" }, { l: K("dash.active_users"), icon: "users", tone: "violet" }] },
    { k: "list", title: K("dash.recent_transactions"), n: 3, fields: ["Date", "Account", "Amount"], status: [["Completed", "ok"], ["Pending", "warn"]], icon: "receipt", tone: "primary", span: "main" },
    { k: "card", title: K("dash.currency_rates"), icon: "money", tone: "amber", span: "aside", body: [{ k: "kv", items: ["Currency", "Date"] }] }] });
  add({ id: "d3", group: "dash", apps: ["bs"], title: "Dashboard", routes: ["/dashboard/shipping-line"], blocks: [
    { k: "hero", title: K("shtrk.live_tracking"), sub: K("shtrk.subtitle"), art: "ship" },
    { k: "kpis", items: [{ l: K("shtrk.lbl_total_shipments"), icon: "ship", tone: "teal" }, { l: K("shtrk.lbl_total_containers"), icon: "box", tone: "primary" }, { l: K("shtrk.lbl_in_transit"), icon: "route", tone: "sky" }, { l: K("shtrk.lbl_delayed"), icon: "clock", tone: "amber" }] },
    { k: "card", title: K("shtrk.card_status"), icon: "chart", tone: "teal", span: "half", body: [{ k: "chips", items: [K("shtrk.lbl_booking_confirmed"), K("shtrk.lbl_loaded_gate_in"), K("shtrk.lbl_in_transit"), K("shtrk.lbl_arrived_dest"), K("shtrk.lbl_delayed")], on: 2 }] },
    { k: "list", title: K("shtrk.list_title"), n: 3, fields: [K("shtrk.col_container_no"), K("shtrk.col_vessel_voyage"), K("shtrk.col_eta")], status: [[K("shtrk.lbl_in_transit"), "info"], [K("shtrk.st_completed"), "ok"], [K("shtrk.lbl_delayed"), "warn"]], icon: "ship", tone: "teal", span: "half" }] });
  add({ id: "d4", group: "dash", apps: ["bs"], title: "Clearing Agent", routes: ["/dashboard/clearing-agent"], note: "Quick-access tiles are the real clearing modules (no invented KPIs).", blocks: [
    { k: "hero", title: "Clearing Workspace", sub: "Shipping & Clearing", art: "containers" },
    { k: "qa", items: [{ l: "New Customer Order", icon: "box", tone: "primary" }, { l: "Customer Bills", icon: "receipt", tone: "green" }, { l: "Truck Register", icon: "truck", tone: "amber" }, { l: "Agent List", icon: "users", tone: "violet" }, { l: "Custom Bills", icon: "file", tone: "red" }, { l: "Transfer & Handover Center", icon: "inbox", tone: "teal" }, { l: K("shtrk.live_tracking"), icon: "route", tone: "sky" }, { l: "Reports", icon: "chart", tone: "primary" }] }] });
  add({ id: "d5", group: "dash", apps: ["bs"], title: "Logistics Tracking Dashboard", routes: ["/dashboard/logistics"], blocks: [
    { k: "hero", title: K("shtrk.card_movement"), sub: K("shtrk.list_desc"), art: "containers" },
    { k: "kpis", items: [{ l: K("shtrk.lbl_total_shipments"), icon: "ship", tone: "teal" }, { l: K("shtrk.lbl_in_transit"), icon: "route", tone: "sky" }, { l: K("shtrk.lbl_arrived_dest"), icon: "anchor", tone: "green" }, { l: K("shtrk.lbl_pending"), icon: "clock", tone: "amber" }] },
    { k: "list", title: K("shtrk.list_title"), n: 3, fields: [K("shtrk.col_current_location"), K("shtrk.col_eta")], status: [[K("shtrk.lbl_in_transit"), "info"]], icon: "map", tone: "sky" }] });

  // ───────────────────────── 3. navigation ─────────────────────────
  const m = (l, icon, cur) => ({ l, icon, cur });
  add({ id: "n1", group: "nav", layout: "drawer", apps: ["b"], role: "Super Admin", routes: ["components/layout/digital-dock-premium-sidebar.tsx"], note: "Super Admin: every Business group.", blocks: [{ k: "menu", groups: [
    { items: [m("Dashboard", "home", true), m("Smart Operations", "tasks"), m("AI Business Assistant", "mic"), m("New Entry", "plus")] },
    { g: "Daily Payment Entry", items: [m("Daily Cash Entry (Roznamcha)", "money"), m("Ledgers", "book"), m("Daily Exchange Rate", "chart")] },
    { g: "Purchase, Sales & Trade", items: [m("Purchase Booking", "cart"), m("Sales Booking", "tag"), m("Local Purchase", "cart"), m("Journal Stock", "stock")] },
    { g: "Finance", items: [m("Banks & Bank Accounts", "building"), m("Settlement & Reconciliation", "refresh"), m("Reports and All Reporting Page", "chart"), m("General Office", "users")] }] }] });
  add({ id: "n2", group: "nav", layout: "drawer", apps: ["b"], role: "Accountant", routes: ["components/layout/digital-dock-premium-sidebar.tsx"], note: "Accountant: no user/branch administration, no super-admin audit tools.", blocks: [{ k: "menu", groups: [
    { items: [m("Dashboard", "home", true), m("Smart Operations", "tasks"), m("Entry Edit & Delete Control", "edit")] },
    { g: "Daily Payment Entry", items: [m("Daily Cash Entry (Roznamcha)", "money"), m("Ledgers", "book")] },
    { g: "Purchase, Sales & Trade", items: [m("Purchase Booking", "cart"), m("Sales Booking", "tag")] },
    { g: "Finance", items: [m("Reports and All Reporting Page", "chart")] }] }] });
  add({ id: "n3", group: "nav", layout: "drawer", apps: ["bs"], role: "Super Admin", routes: ["components/layout/digital-dock-premium-sidebar.tsx"], note: "Shipping domain: the Shipping & Clearing accordion is the core; business-only groups are hidden by the domain rule.", blocks: [{ k: "menu", groups: [
    { items: [m("Dashboard", "home", true), m("Smart Operations", "tasks")] },
    { g: "Shipping & Clearing", items: [m("New Customer Order", "box"), m("Customer Bills", "receipt"), m("Clearing Agent", "users"), m("Clearing Truck", "truck"), m("Shipping Lines", "ship"), m("BL Entry", "file"), m(K("shtrk.title"), "route")] },
    { items: [m("Transfer & Handover Center", "inbox"), m("Ledgers", "book"), m("Reports and All Reporting Page", "chart")] }] }] });
  add({ id: "n4", group: "nav", layout: "drawer", apps: ["bs"], role: "Agent", routes: ["components/layout/digital-dock-premium-sidebar.tsx"], note: "Agent / shipping-scoped login: only its own shipping modules and its own ledger.", blocks: [{ k: "menu", groups: [
    { items: [m("Dashboard", "home", true), m("Smart Operations", "tasks")] },
    { g: "Shipping & Clearing", items: [m("New Customer Order", "box"), m("Customer Bills", "receipt"), m(K("shtrk.live_tracking"), "route")] },
    { items: [m("Transfer & Handover Center", "inbox"), m("Detailed Ledger Statement", "book")] }] }] });
  add({ id: "n5", group: "nav", title: "More", nav: 4, routes: ["(bottom tab 'More')"], note: "More tab: module tiles for everything not in the bottom bar (role-filtered).", blocks: [
    { k: "search", ph: "Search", filter: false },
    { k: "qa", items: [{ l: "Ledgers", icon: "book", tone: "primary" }, { l: "Reports", icon: "chart", tone: "violet" }, { l: "Customers", icon: "users", tone: "green" }, { l: "Settings", icon: "settings", tone: "neutral" }, { l: "User Tasks", icon: "tasks", tone: "amber" }, { l: "Transfer & Handover Center", icon: "inbox", tone: "teal" }, { l: "Profile", icon: "user", tone: "sky" }, { l: "Language", icon: "globe", tone: "primary" }] }] });

  // ───────────────────────── 4. business modules ─────────────────────────
  add({ id: "m1", group: "biz", apps: ["b"], nav: 1, title: "Purchase Booking", routes: ["/dashboard/purchase/purchase-booking-journal-report"], blocks: [
    { k: "search", ph: "Search" }, { k: "chips", items: ["All", "Pending", "Approved", "Completed"], on: 0 },
    { k: "table", cols: ["Date", "Supplier", "Goods", "Quantity", "Amount"], rows: 4, status: [["Pending", "warn"], ["Approved", "info"], ["Completed", "ok"]], actions: ["eye", "edit", "print"], icon: "cart", tone: "primary" }] });
  add({ id: "m2", group: "biz", apps: ["b"], nav: 1, title: "New Purchase Booking Order", routes: ["/dashboard/purchase/new-purchase-booking-order"], blocks: [
    { k: "form", title: "Purchase Booking", icon: "cart", fields: [{ l: "Country", t: "select" }, { l: "Branch", t: "select" }, { l: "Supplier", t: "select" }, { l: "Goods", t: "select" }, { l: "Quantity" }, { l: "Weight" }, { l: "Currency", t: "select" }, { l: "Amount" }, { l: "Date", t: "date" }, { l: "Remarks", t: "textarea" }], actions: [{ l: "Cancel", v: "s" }, { l: "Save", v: "p", i: "check" }] }] });
  add({ id: "m3", group: "biz", apps: ["b"], nav: 1, title: "Purchase Payments", routes: ["/dashboard/purchase/purchase-payments", "/dashboard/journal/purchase-order-payment/advance"], blocks: [
    { k: "tabs", items: ["Advance Payment", "Remaining Payment", "Final Payment"], on: 0 },
    { k: "list", n: 3, fields: ["Date", "Supplier", "Amount", "Currency"], status: [["Pending", "warn"], ["Completed", "ok"]], icon: "wallet", tone: "amber", actions: ["eye", "print"] }] });
  add({ id: "m4", group: "biz", apps: ["b"], nav: 2, title: "New Sales Booking Order", routes: ["/dashboard/sales/new-sales-booking-order"], blocks: [
    { k: "form", title: "Sales Booking", icon: "tag", fields: [{ l: "Customer", t: "select" }, { l: "Goods", t: "select" }, { l: "Quantity" }, { l: "Currency", t: "select" }, { l: "Amount" }, { l: "Date", t: "date" }, { l: "Remarks", t: "textarea" }], actions: [{ l: "Cancel", v: "s" }, { l: "Save", v: "p", i: "check" }] }] });
  add({ id: "m5", group: "biz", apps: ["b"], nav: 2, title: "Confirmed Sales Orders", routes: ["/dashboard/sales/sales-confirm"], blocks: [
    { k: "search", ph: "Search" },
    { k: "table", cols: ["Date", "Customer", "Goods", "Quantity", "Amount"], rows: 4, status: [["Approved", "info"], ["Completed", "ok"]], actions: ["eye", "print"], icon: "tag", tone: "green" }] });
  add({ id: "m6", group: "biz", apps: ["b"], nav: 4, title: "Confirmed Stock", routes: ["/dashboard/purchase/stock/confirmed"], blocks: [
    { k: "kpis", items: [{ l: "Quantity", icon: "stock", tone: "teal" }, { l: "Weight", icon: "box", tone: "primary" }] },
    { k: "search", ph: "Search" },
    { k: "table", cols: ["Goods", "Quantity", "Weight", "Branch"], rows: 4, status: [["Completed", "ok"]], icon: "stock", tone: "teal" }] });

  // ───────────────────────── 5. shipping ─────────────────────────
  add({ id: "s1", group: "ship", apps: ["bs", "b"], nav: 2, title: "Customer Order", routes: ["/dashboard/clearing-agent/customer-order"], note: "B app: only Operations Admins (domain 'both').", blocks: [
    { k: "search", ph: "Search" }, { k: "chips", items: ["All", "Pending", "In Transit", "Completed"], on: 0 },
    { k: "table", cols: ["Date", "Customer", "Container", "Port", "Amount"], rows: 4, status: [["Pending", "warn"], ["In Transit", "info"], ["Completed", "ok"]], actions: ["eye", "edit"], icon: "box", tone: "primary" },
    { k: "actions", items: [{ l: "New Customer Order", v: "p", i: "plus" }] }] });
  add({ id: "s2", group: "ship", apps: ["bs", "b"], nav: 2, title: "New Customer Order", routes: ["/dashboard/clearing-agent/customer-order"], blocks: [
    { k: "form", title: "New Customer Order", icon: "box", fields: [{ l: "Customer", t: "select" }, { l: "Goods", t: "select" }, { l: "Container" }, { l: "Port", t: "select" }, { l: "Truck", t: "select" }, { l: "Date", t: "date" }, { l: "Remarks", t: "textarea" }], actions: [{ l: "Cancel", v: "s" }, { l: "Save", v: "p", i: "check" }] }] });
  add({ id: "s3", group: "ship", apps: ["bs"], nav: 1, title: K("shtrk.title"), routes: ["/dashboard/shipping-line/tracking"], note: "Tablet: master-detail. Phone: list → detail screen (S4).", blocks: [
    { k: "search", ph: K("shtrk.search_ph") }, { k: "chips", items: [K("shtrk.all"), K("shtrk.lbl_in_transit"), K("shtrk.st_destination_review"), K("shtrk.st_completed"), K("shtrk.lbl_pending")], on: 0, span: "main" },
    { k: "list", n: 4, fields: [K("shtrk.col_container_no"), K("shtrk.col_bl_no"), K("shtrk.col_vessel_voyage"), K("shtrk.col_eta")], status: [[K("shtrk.lbl_in_transit"), "info"], [K("shtrk.st_completed"), "ok"], [K("shtrk.lbl_pending"), "warn"]], icon: "ship", tone: "teal", span: "main" },
    { k: "card", title: K("shtrk.detail_title"), icon: "box", tone: "teal", span: "aside", body: [
      { k: "tabs", items: [K("shtrk.tab_location"), K("shtrk.tab_journey"), K("shtrk.tab_documents")], on: 1 },
      { k: "route", from: K("shtrk.origin"), to: K("shtrk.destination") },
      { k: "steps", items: [{ l: K("shtrk.lbl_booking_confirmed"), st: "done" }, { l: K("shtrk.lbl_loaded_gate_in"), st: "done" }, { l: K("shtrk.lbl_in_transit"), st: "now" }, { l: K("shtrk.lbl_arrived_dest"), st: "todo" }] }] }] });
  add({ id: "s4", group: "ship", apps: ["bs"], nav: 1, title: K("shtrk.detail_title"), routes: ["/dashboard/shipping-line/shipment-details"], note: "Shipment detail: journey timeline, multi-leg sequence, linked documents.", blocks: [
    { k: "tabs", items: [K("shtrk.tab_location"), K("shtrk.tab_journey"), K("shtrk.tab_documents")], on: 1 },
    { k: "route", from: K("shtrk.origin"), to: K("shtrk.destination") },
    { k: "steps", title: K("shtrk.timeline_title"), items: [{ l: K("shtrk.lbl_booking_confirmed"), st: "done" }, { l: K("shtrk.lbl_loaded_gate_in"), st: "done" }, { l: K("shtrk.lbl_in_transit"), st: "now" }, { l: K("shtrk.lbl_customs"), st: "todo" }, { l: K("shtrk.lbl_arrived_dest"), st: "todo" }] },
    { k: "kv", title: K("shtrk.multi_leg_title"), items: [K("shtrk.lbl_vessel"), K("shtrk.lbl_voyage"), K("shtrk.lbl_container"), K("shtrk.lbl_seal"), K("shtrk.expected_arrival")] }] });
  add({ id: "s5", group: "ship", apps: ["bs"], nav: 1, title: "BL Entry", routes: ["/dashboard/shipping-line/bl-entry"], blocks: [
    { k: "form", title: "BL Entry", icon: "file", fields: [{ l: K("shtrk.col_bl_no") }, { l: K("shtrk.col_shipping_line"), t: "select" }, { l: K("shtrk.col_vessel_voyage") }, { l: K("shtrk.col_container_no") }, { l: K("shtrk.col_from"), t: "select" }, { l: K("shtrk.col_to"), t: "select" }, { l: K("shtrk.col_eta"), t: "date" }, { l: "Remarks", t: "textarea" }], actions: [{ l: "Cancel", v: "s" }, { l: "Save", v: "p", i: "check" }] }] });
  add({ id: "s6", group: "ship", apps: ["bs"], nav: 2, title: "Clearing Workspace", routes: ["/dashboard/clearing-agent/clearing-workspace"], blocks: [
    { k: "steps", title: "Clearing Workspace", items: [{ l: "Booked", st: "done" }, { l: "Loading", st: "done" }, { l: "Customs", st: "now" }, { l: "Delivered", st: "todo" }], span: "half" },
    { k: "list", n: 3, fields: ["Customer", "Container", "Port"], status: [["Pending", "warn"], ["Completed", "ok"]], icon: "box", tone: "primary", span: "half" }] });
  add({ id: "s7", group: "ship", apps: ["bs"], nav: 2, title: "Agent List", routes: ["/dashboard/clearing-agent/list"], blocks: [
    { k: "search", ph: "Search" }, { k: "list", n: 4, fields: ["Country", "Branch", "Currency"], status: [["Approved", "ok"]], icon: "users", tone: "violet", actions: ["eye", "edit"] }] });
  add({ id: "s8", group: "ship", apps: ["bs"], nav: 2, title: "Truck Register", routes: ["/dashboard/clearing-agent/truck-registration"], blocks: [
    { k: "form", title: "Truck Register", icon: "truck", fields: [{ l: K("shtrk.lbl_truck") }, { l: K("shtrk.lbl_driver") }, { l: K("shtrk.lbl_driver_mobile") }, { l: "Country", t: "select" }], actions: [{ l: "Save", v: "p", i: "check" }], span: "half" },
    { k: "list", n: 3, fields: [K("shtrk.lbl_truck"), K("shtrk.lbl_driver")], icon: "truck", tone: "amber", span: "half" }] });
  add({ id: "s9", group: "ship", apps: ["bs"], nav: 2, title: "Customer Bills", routes: ["/dashboard/clearing-agent/customer-bill"], blocks: [
    { k: "tabs", items: ["Customer Bills", "Custom Bills", "Truck Expenses Bills"], on: 0 },
    { k: "table", cols: ["Date", "Customer", "Amount", "Currency"], rows: 4, status: [["Pending", "warn"], ["Completed", "ok"]], actions: ["eye", "print"], icon: "receipt", tone: "green" }] });

  // ───────────────────────── 6. accounts & reports ─────────────────────────
  add({ id: "r1", group: "acct", nav: 3, title: "Detailed Ledger Statement", routes: ["/dashboard/ledger/detailed"], blocks: [
    { k: "form", fields: [{ l: "Account", t: "select" }, { l: "Date", t: "date" }], actions: [{ l: "Search", v: "p", i: "search" }], span: "full" },
    { k: "kpis", items: [{ l: "Debit", icon: "money", tone: "red" }, { l: "Credit", icon: "wallet", tone: "green" }, { l: "Balance", icon: "book", tone: "primary" }] },
    { k: "table", cols: ["Date", "Remarks", "Debit", "Credit", "Balance"], rows: 5, icon: "receipt", tone: "primary" }] });
  add({ id: "r2", group: "acct", nav: 3, title: "Outstanding Ledgers Report", routes: ["/dashboard/ledger/outstanding"], blocks: [
    { k: "search", ph: "Search" }, { k: "table", cols: ["Account", "Debit", "Credit", "Balance"], rows: 5, status: [["Pending", "warn"]], icon: "book", tone: "amber" }] });
  add({ id: "r3", group: "acct", nav: 3, title: "Daily Cash Entry (Roznamcha)", routes: ["/dashboard/roznamcha/cash-entry"], blocks: [
    { k: "form", title: "Daily Cash Entry (Roznamcha)", icon: "money", fields: [{ l: "Date", t: "date" }, { l: "Account", t: "select" }, { l: "Debit" }, { l: "Credit" }, { l: "Currency", t: "select" }, { l: "Remarks", t: "textarea" }], actions: [{ l: "Cancel", v: "s" }, { l: "Save", v: "p", i: "check" }] }] });
  add({ id: "r4", group: "acct", nav: 4, title: "Reports", routes: ["/dashboard/reports", "/dashboard/reports/shipping"], note: "Reports hub: cards link to the existing report pages.", blocks: [
    { k: "search", ph: "Search", filter: false },
    { k: "qa", items: [{ l: "Financial Statements", icon: "chart", tone: "primary" }, { l: "Payments & Settlements Report", icon: "wallet", tone: "green" }, { l: "Shipping & Clearing Reports", icon: "ship", tone: "teal" }, { l: "Branch Reports", icon: "building", tone: "amber" }, { l: "Country Admin Reports", icon: "globe", tone: "violet" }, { l: "Journal Reporting", icon: "book", tone: "sky" }] }] });
  add({ id: "r5", group: "acct", nav: 4, title: "Reports", routes: ["(universal report preview — print / PDF)"], note: "Report preview in the selected language; phone scales the A4 page to fit (PdfPreviewModal).", blocks: [
    { k: "card", title: "Reports", icon: "file", body: [{ k: "kv", items: ["Date", "Country", "Branch", "Currency"] }, { k: "table", cols: ["Date", "Account", "Debit", "Credit"], rows: 4 }] },
    { k: "actions", items: [{ l: "Print", v: "s", i: "print" }, { l: "Export", v: "s", i: "download" }] }] });

  // ───────────────────────── 7. notifications & tasks ─────────────────────────
  add({ id: "t1", group: "notif", nav: 3, title: "Transfer & Handover Center", routes: ["/dashboard/transfer-center", "/dashboard/shipping-line/handover-inbox"], blocks: [
    { k: "seg", items: ["Inbox", "Pending", "Completed"] },
    { k: "list", n: 4, fields: ["Date", "Branch", "Country"], status: [["Pending", "warn"], ["Approved", "ok"], ["Rejected", "bad"]], icon: "inbox", tone: "teal", actions: ["check", "x"] }] });
  add({ id: "t2", group: "notif", nav: 0, title: "Smart Operations", routes: ["/dashboard/smart-operations"], blocks: [
    { k: "kpis", items: [{ l: K("dash.pending_approvals"), icon: "shield", tone: "amber" }, { l: "User Tasks", icon: "tasks", tone: "violet" }] },
    { k: "list", n: 3, fields: ["Date", "Remarks"], status: [["Pending", "warn"]], icon: "clock", tone: "amber" }] });
  add({ id: "t3", group: "notif", nav: 3, title: "User Tasks", routes: ["/dashboard/user-tasks"], blocks: [
    { k: "tabs", items: ["All", "Pending", "Completed"], on: 1 },
    { k: "list", n: 4, fields: ["Date", "Remarks"], status: [["Pending", "warn"], ["Completed", "ok"]], icon: "tasks", tone: "violet", actions: ["check"] }] });

  // ───────────────────────── 8. settings & profile ─────────────────────────
  add({ id: "p1", group: "set", nav: 4, title: "Profile", routes: ["/dashboard/settings/profile"], blocks: [
    { k: "profile" }, { k: "menu", groups: [{ items: [m("Language", "globe"), m(K("nav.theme_mode"), "sun"), m("Settings", "settings")] }] },
    { k: "actions", items: [{ l: K("appch.sign_out"), v: "s", i: "logout" }] }] });
  add({ id: "p2", group: "set", nav: 4, title: "Language", routes: ["(language sheet)"], note: "Five languages; choosing one flips the whole screen (dir) and persists.", blocks: [{ k: "lang" }] });
  add({ id: "p3", group: "set", nav: 4, title: K("nav.theme_mode"), routes: ["/dashboard/settings/template-color", "(theme modes)"], blocks: [
    { k: "seg", items: [K("nav.theme_day"), K("nav.theme_soft"), K("nav.theme_night")], on: 0 }] });

  // ───────────────────────── 9. states ─────────────────────────
  add({ id: "x1", group: "states", title: "Dashboard", routes: ["(empty list)"], blocks: [{ k: "state", kind: "empty", title: "No records found.", text: K("shtrk.adjust_filters"), action: "Clear filters" }] });
  add({ id: "x2", group: "states", title: "Dashboard", routes: ["(loading)"], blocks: [{ k: "state", kind: "loading", title: "Loading...", text: K("shtrk.loading_records") }] });
  add({ id: "x3", group: "states", title: "Dashboard", routes: ["(error)"], blocks: [{ k: "state", kind: "error", title: K("mdev.err_generic"), text: K("shtrk.err_load_list"), action: "Retry" }] });
  add({ id: "x4", group: "states", title: "Dashboard", routes: ["mobile-shell/offline.html"], note: "Offline page (already 5-language). Its title still says 'Digital Dock ERP' — to be branded per app (flagged).", blocks: [{ k: "state", kind: "offline", title: "Offline", text: "Retry", action: "Retry" }] });

  // ───────────────────────── component inventory (components.html) ─────────────────────────
  const C = [];
  const cadd = (id, name, blocks, o) => C.push(Object.assign({ id, name, blocks }, o || {}));
  cadd("c1", "Button/Primary · Secondary · Ghost · Danger · Disabled · Small", [{ k: "actions", items: [{ l: "Save", v: "p", i: "check" }, { l: "Cancel", v: "s" }] }, { k: "actions", items: [{ l: "Back", v: "g" }, { l: "Delete", v: "d", i: "trash" }] }, { k: "actions", items: [{ l: "Submit", v: "p off" }, { l: "Print", v: "s sm", i: "print" }] }]);
  cadd("c2", "Input/Text · Select · Date · Password · Textarea · Error", [{ k: "form", fields: [{ l: "Customer" }, { l: "Country", t: "select" }, { l: "Date", t: "date" }, { l: L("passwordPlaceholder"), t: "pass" }, { l: "Remarks", t: "textarea" }, { l: "Amount", err: true, hint: K("mdev.err_generic") }] }]);
  cadd("c3", "Input/OTP (activation code, always LTR) · Search", [{ k: "otp" }, { k: "search", ph: "Search" }]);
  cadd("c4", "Chip/Filter · Tabs/Underline · Tabs/Segmented", [{ k: "chips", items: ["All", "Pending", "Approved", "Completed"], on: 0 }, { k: "tabs", items: ["Advance Payment", "Remaining Payment", "Final Payment"], on: 0 }, { k: "seg", items: ["Inbox", "Pending", "Completed"], on: 1 }]);
  cadd("c5", "Pill/Status — success · warning · danger · info · neutral (icon + label, never colour alone)", [{ k: "pills", pairs: [["Completed", "ok"], ["Pending", "warn"], ["Rejected", "bad"], ["Approved", "info"], ["Draft", "neu"]] }]);
  cadd("c6", "Card/KPI-3D (tinted base edge, gem chip, tabular numbers)", [{ k: "kpis", items: [{ l: K("dash.total_sales"), icon: "chart", tone: "green" }, { l: K("dash.total_purchase"), icon: "cart", tone: "primary" }, { l: K("dash.total_receivables"), icon: "wallet", tone: "amber" }, { l: K("dash.total_payables"), icon: "money", tone: "red" }] }]);
  cadd("c7", "Icon/Gem — tones: primary · green · amber · red · teal · violet · sky", [{ k: "gems", icons: ["home", "cart", "tag", "ship", "box", "truck", "inbox", "book"] }]);
  cadd("c8", "Card/Hero-3D — isometric art: ledger · ship · containers · bars", [{ k: "hero", title: K("dash.financial_overview_live"), sub: K("dash.live_db_overview_subtitle"), art: "ledger" }, { k: "hero", title: K("shtrk.live_tracking"), sub: K("shtrk.subtitle"), art: "ship" }, { k: "hero", title: K("shtrk.card_movement"), sub: K("shtrk.list_desc"), art: "containers" }, { k: "hero", title: K("dash.sales_vs_purchase"), sub: K("dash.live_db_overview_subtitle"), art: "bars" }], { wide: true });
  cadd("c9", "Card/Chart-3D (placeholder bars) · Card/Detail (key-value)", [{ k: "chart", title: K("dash.sales_vs_purchase") }, { k: "kv", title: K("shtrk.multi_leg_title"), items: [K("shtrk.lbl_vessel"), K("shtrk.lbl_voyage"), K("shtrk.lbl_container")] }]);
  cadd("c10", "Card/List-Item (phone card form of a table row)", [{ k: "list", n: 2, fields: [K("shtrk.col_container_no"), K("shtrk.col_bl_no"), K("shtrk.col_vessel_voyage"), K("shtrk.col_eta")], status: [[K("shtrk.lbl_in_transit"), "info"], [K("shtrk.st_completed"), "ok"]], icon: "ship", tone: "teal", actions: ["eye", "edit", "print"] }]);
  cadd("c11", "Table (tablet ≥ 820) — same columns collapse to Card/List-Item on phone", [{ k: "table", cols: ["Date", "Customer", "Container", "Port", "Amount"], rows: 3, status: [["Pending", "warn"], ["Completed", "ok"]], actions: ["eye", "edit"] }], { wide: true, tablet: true });
  cadd("c12", "Card/Notice — info · warning · success · danger", [{ k: "notice", tone: "info", text: K("mdev.identifier_hint") }, { k: "notice", tone: "warn", text: K("appch.contact") }, { k: "notice", tone: "ok", text: K("mdev.active_title") }, { k: "notice", tone: "bad", text: K("mdev.err_generic") }]);
  cadd("c13", "Nav/AppBar", [{ k: "appbar", title: "Dashboard" }]);
  cadd("c14", "Nav/BottomTabs (phone) — order mirrors in RTL", [{ k: "tabbar" }]);
  cadd("c15", "Nav/SideRail (tablet) — docks to the right in RTL", [{ k: "railbar" }], { wide: true });
  cadd("c16", "Nav/Drawer-menu (role-filtered, real sidebar labels)", [{ k: "menu", groups: [{ items: [m("Dashboard", "home", true), m("Smart Operations", "tasks")] }, { g: "Shipping & Clearing", items: [m("New Customer Order", "box"), m("BL Entry", "file")] }] }]);
  cadd("c17", "QuickAccess/Tile", [{ k: "qa", items: [{ l: "New Customer Order", icon: "box", tone: "primary" }, { l: "Customer Bills", icon: "receipt", tone: "green" }, { l: "Truck Register", icon: "truck", tone: "amber" }, { l: "Reports", icon: "chart", tone: "violet" }] }]);
  cadd("c18", "Stepper/Timeline · Route/Line", [{ k: "route", from: K("shtrk.origin"), to: K("shtrk.destination") }, { k: "steps", items: [{ l: K("shtrk.lbl_booking_confirmed"), st: "done" }, { l: K("shtrk.lbl_in_transit"), st: "now" }, { l: K("shtrk.lbl_arrived_dest"), st: "todo" }] }]);
  cadd("c19", "Sheet/Language", [{ k: "lang" }]);
  cadd("c20", "State/Empty · Loading · Error · Offline", [{ k: "state", kind: "empty", title: "No records found.", text: K("shtrk.adjust_filters"), action: "Clear filters" }, { k: "state", kind: "loading", title: "Loading...", text: K("shtrk.loading_records") }, { k: "state", kind: "error", title: K("mdev.err_generic"), text: K("shtrk.err_load_list"), action: "Retry" }], { wide: true });
  return { groups, screens: S, components: C };
}
