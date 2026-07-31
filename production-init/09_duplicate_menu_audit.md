# Duplicate Menu Audit — evidence before any removal

**Method:** extracted every `href` in `lib/navigation/sidebar.ts` and found routes that
appear in **more than one** menu item. Nothing has been removed yet (your rule:
verify + backup first). Removal is **menu-only** (delete the duplicate nav entry) —
it does NOT touch pages, APIs, database tables, or permissions, so no functionality
breaks. Each page/table/API stays as the single source; only the extra nav link goes.

## Confirmed duplicate menu entries (same route, two menu locations)

| Route | Location A (keep) | Location B (remove) |
|---|---|---|
| `/dashboard/logistics` | `dash-logistics` — under **Dashboard** | `logistics-dashboard` — under Shipping/Clearing |
| `/dashboard/settings/employees` | `mgmt-employees` "Employee Management" — **Settings → Master Forms** (official master) | `employee-master-form-menu` "Employee Master Setup" — under General Office |
| `/dashboard/settings/email-accounts` | `msg-email-setup` — **Message System** | duplicate under Settings (L1239) |
| `/dashboard/reports` | primary Reports entry | duplicate Reports entry |
| `/dashboard/reports?...financial-summaries&scope=branch/country/super-admin` | one set | duplicate set |
| `/dashboard/accounts` | `accounts` parent node | `accounts-general-report` child points to the same page (parent+child same route — optional) |

> "Keep" vs "remove" above is a recommendation; you decide which side is the official
> one. I will not remove anything until you confirm.

## Goods Master (your example) — needs your input
There is only **one** Goods Master by route: `mgmt-goods-master` → `/dashboard/settings/management/goods`.
I did **not** find a second menu item pointing to that same route. If you see "Goods
Master / Management" in two places, it is likely two **different** routes/labels (e.g.
a "Journal Stock" or "Management" page that also shows goods). Please tell me the exact
second menu location/label you saw, and I will verify + consolidate it.

## Dependency-safety note (your rule #3)
Removing a duplicate **menu entry** cannot break Purchase/Sales/Inventory/Reports —
those modules call the **APIs/tables**, not the sidebar. The single master page/API/table
for each module remains untouched. (True DB-level duplicate *tables* are a separate,
higher-risk task — none found so far except the documents `office_documents` duplicate
already flagged for removal in `08_...report`.)

## Proposed safe action (on your go-ahead, after your backup)
1. Remove the duplicate nav entries in column "remove" above (one commit, menu-only).
2. Keep every page, API, and table exactly as-is (single source of truth preserved).
3. You verify Purchase/Sales/Inventory/Accounts/Reports still work (they will — no API/DB change).

## Your backup first (as you required)
```bash
# source code
git bundle create backup_code_$(date +%Y%m%d).bundle --all
# database
pg_dump "$DATABASE_URL" -Fc -f backup_db_$(date +%Y%m%d_%H%M).dump
```
Reply with which side to keep for each row (or "use recommendations"), and I will apply
the menu-only cleanup and give you the changed file + commit id.
