# Shipping Line & Clearing Agent — ERP Module Structure & Workflow Plan

**Goal:** reorganize the current single "Shipping & Logistics" menu into two professional top-level modules — **Shipping Line** and **Clearing Agent (Customs & Logistics)** — and lay out each sub-module's ERP workflow, data model, documents, and reports for a phased, one-module-at-a-time build.

> Build note: this is the design/blueprint (safe, non-breaking). Each sub-module is then built individually as: sidebar entry + i18n labels (5 languages) + route/page + API route + Drizzle migration + form/report — and verified by you before the next. Accounting/posting forms will reuse the existing idempotency + country/branch scope + double-entry rules.

---

## 1. Proposed menu structure (real `sidebarTree`)

**Shipping Line** (icon: `truck`/`ship`)
- Shipping Line Master — `/dashboard/shipping-line/master`
- Shipment Details — `/dashboard/shipping-line/shipments`
- Shipment Reports — `/dashboard/shipping-line/reports`
- Bill Entry — `/dashboard/shipping-line/bill-entry`
- Payment Bill Entry — `/dashboard/shipping-line/payment-bill-entry`
- *(Loading Records / Containers move here from the old menu)*

**Clearing Agent** (icon: `shield-check`/`file-text`) — separate top-level menu
- Customs Clearance — `/dashboard/clearing-agent/customs-clearance`
- Clearing Agent Expenses — `/dashboard/clearing-agent/expenses`
- Transport & Warehouse — `/dashboard/clearing-agent/transport-warehouse`
- Import Declaration — `/dashboard/clearing-agent/import-declaration`
- Export Declaration — `/dashboard/clearing-agent/export-declaration`
- Transit Declaration — `/dashboard/clearing-agent/transit-declaration`
- Import Transit — `/dashboard/clearing-agent/import-transit`
- Export Transit — `/dashboard/clearing-agent/export-transit`
- Direct Transit — `/dashboard/clearing-agent/direct-transit`

*(Every route above needs a page before its menu link works — built per phase below.)*

---

## 2. Shipping Line sub-modules

| Module | Purpose | Key data |
|---|---|---|
| **Shipping Line Master** | Registry of shipping lines/carriers | name, code, country, contact, vessel/route list, currency, status, country/branch owner |
| **Shipment Details** | Per-shipment record | shipment no, shipping line, vessel, container(s), BL no, ETD/ETA, load/discharge port, goods, weight, status |
| **Bill Entry** | Shipping-line invoice/charges | bill no, shipment ref, charge lines, currency, exchange rate, total |
| **Payment Bill Entry** | Payment against a shipping bill | bill ref, amount, currency, date, ledger posting (DR/CR), idempotency-protected |
| **Shipment Reports** | Filters + totals + print/PDF/Excel | by line, port, date, country/branch, status |

---

## 3. Clearing Agent sub-modules

| Module | Purpose | Key data / documents |
|---|---|---|
| **Customs Clearance** | Customs clearance of a consignment | declaration no, customs office, HS codes, duties/taxes, documents (invoice, packing list, BL, permit), status |
| **Clearing Agent Expenses** | Agent expenses per consignment | expense heads (customs duty, port, handling, agent fee…), amount, currency, ledger posting |
| **Import Declaration** | Goods imported into a country | importer, country of origin, goods, HS, value, duty, customs office |
| **Export Declaration** | Goods exported from a country | exporter, destination, goods, HS, value, permits |
| **Transit Declaration** | Goods passing through under transit | transit type, entry/exit points, bond/guarantee, seals |

---

## 4. Transport & Warehouse Management (design)

Manages transport companies, warehouses, loading/unloading points and the **full movement of goods warehouse-to-warehouse**, with complete history.

**Tables (Drizzle):**
- `transport_companies` — name, code, contact, vehicles, country/branch owner.
- `warehouses` — name, code, location (country/city/address), type (bonded/general), capacity, owner scope.
- `loading_points` / `unloading_points` — named nodes with location.
- `goods_movements` — the core log: `movement_no`, goods ref, from_warehouse/loading_point, to_warehouse/unloading_point, transport_company, vehicle, driver, qty/weight, dispatch_date, delivery_date, status (dispatched/in-transit/delivered), remarks.
- `goods_movement_legs` — each hop (collected → transported → delivered) for full history.

**Workflow:** collect at origin → assign transport → dispatch → in-transit updates → deliver at destination → close. Every stage is timestamped and country/branch-scoped; delivery updates warehouse stock.

---

## 5. Transit Management (design)

One `transit_declarations` table + `transit_route_legs` (ordered border/route hops), driven by `transit_type`:

| Type | Flow | Example |
|---|---|---|
| **Import Transit** | Goods enter one country and move through another before the final destination | Afghanistan → Chaman → Karachi → India |
| **Export Transit** | Goods exported from one country, transported through another to the destination | UAE → Iran → Afghanistan |
| **Direct Transit** | Goods move directly through an approved border route, no extra import processing | Afghanistan → Chaman → Wagah → India |

**Per declaration:** origin, destination, ordered route legs (country, border/checkpoint, entry/exit dates), goods, seals, bond/guarantee ref, customs offices per leg, documents, status (open/in-transit/cleared/closed), country/branch scope.

---

## 6. Cross-cutting (every module)
Document tracking (attachments per record), customs info, expenses posting (DR/CR into ledger with idempotency + transactions), country/branch/user scope enforced, filters + totals, PDF/Excel/Print/Email/WhatsApp, and full 5-language (en/ar/ur/fa/ps) + RTL — using the existing engines, so no duplicate infrastructure.

---

## 7. Phased build order (recommended)
1. **Menu reorganization** — add the two menus + all sub-items to `sidebarTree` + i18n (skeleton; links land once pages exist).
2. **Shipping Line Master** + **Shipment Details** (masters first).
3. **Transport & Warehouse Management** (tables + movement log).
4. **Customs Clearance** + **Clearing Agent Expenses** (with ledger posting).
5. **Import / Export / Transit Declarations**.
6. **Import / Export / Direct Transit** (route legs).
7. **Shipment Reports** + PDF/Excel/Print for all.

Each phase = migration + API + page + form + verify (your `npm run build` + real-data test).

---

## 8. Next step
Tell me which to start with. Recommended: **Phase 1 (menu reorganization)** first — I'll add the Shipping Line + Clearing Agent menus and all sub-items to the real `sidebarTree` with 5-language labels (safe, non-breaking), then build **Shipping Line Master** as the first working module.
