# DGT ERP — Main Master Progress Report
Owner-facing. Updated 2026-10-18 20:30 Dubai (UTC+4). (No earlier file with this name was found in the repository or on the Desktop — if one exists elsewhere, tell me where and I will merge this into it.)

## Mobile apps — DGT.llc B (Business) and DGT.llc BS (Shipping)

### Design approval gate (owner order of 2026-10-18)
| Item | Status |
|---|---|
| Final mobile UI / final store screenshots | **ON HOLD until the owner approves one Figma concept.** Screenshot rebuilding stopped; existing screenshots marked DRAFT (`docs/store/screenshots/DRAFT-NOT-APPROVED.txt`). |
| Figma connection | **BLOCKED — waiting for the owner's one click** (Connect card for the Figma connector `https://mcp.figma.com/mcp`, OAuth). Not connected yet; I cannot sign in for the owner. |
| Three design concepts (login, device activation, dashboard, navigation menu, customer order, shipment tracking, sample report; phone + tablet; English + Urdu RTL) | **STARTED 2026-10-18.** Target: Mon 2026-10-19 12:00 Dubai. |
| Complete approved design (both apps, 5 languages, iPhone/iPad/Android/tablets, light + dark) | Target: Thu 2026-10-22 18:00 Dubai, if the concept is approved on 19 Oct. |
| Implementation in both apps | Starts the hour the concept is approved; target Tue 2026-10-27 (see store-date impact). |

### Not blocked by the design (continuing in parallel)
* Production security: reversible ref lock installed + verified on the live server (2026-10-11); owner decisions pending (Daily Payments change A/B/C, GitHub `production` ruleset, branch switch, two unused SSH keys).
* Device approval + review pass (store-review access): built and proven on the Testing database only — 35/35, 32/32, 26/26, 12/12 end-to-end checks. Production migrations `20261232` / `20261233` need the owner's approval and a verified backup.
* ERP sweep (9,550 device/language/route cases): all cases run; remaining real defects fixed or listed (Edit History loads slowly: a 5–20 s query over 5,000 history rows).
* Registrations (owner-only): D-U-N-S, Apple / Google / Samsung accounts, payments, OTP.

### Store-date impact of the new design gate
The old targets (Google Play 25–29 Oct, Samsung end Oct, Apple early Nov) assumed the current design. With a new design, the implementation + new store screenshots + a new signed build move **Google Play submission to about 28 Oct → live about 1–5 Nov**, Samsung about 5–8 Nov, Apple about 10–15 Nov. These dates also depend on the owner finishing the store registrations.

### Update 2026-10-18 23:00 Dubai — three design concepts delivered (not final)
* Concepts A **Harbour Ledger** (light, navy + brass, bottom tabs), B **Night Dock** (dark control room, teal + amber, floating nav), C **Manifest** (flat editorial, black/white + orange, side drawer).
* 10 screens each (Login, Device activation, Dashboard B, Dashboard BS, Menu, Customer order, Shipment tracking, Report + 2 tablet screens) in English and Urdu RTL. Folder: `Desktop\DGT-Mobile-Design-Concepts` (compare sheets, boards, single screens, Figma plugin). Sources: `docs/design/mobile-concepts`.
* Figma: connector still NOT connected (owner click needed). Editable Figma file = run the plugin in Figma Desktop (steps in the folder) — the plugin has not yet been run inside Figma by me.
* Owner decision needed: choose A, B or C (or a mix). No final UI, no store screenshots, no implementation until then.
