# START HERE — what the company owner must do first (in this order)

Targets you asked for (subject to store approval): **Google Play 25–29 Oct · Samsung Galaxy Store end of October · Apple App Store early November.**
Everything below is the critical path. Items marked **(you)** cannot be done by anyone else; I prepare everything else.

## Step 1 — D-U-N-S number (today, ~15 minutes to start) — blocks all three stores
**1a. Check if the company already has one**
* D&B UAE directory / lookup (search by company name or trade licence number **1099620**): start at https://dnbuae.com and use the "DUNS number lookup", or the global directory https://www.dnb.com/duns-number/lookup.html
* Apple's own lookup (needs any Apple ID, free): https://developer.apple.com/enroll/duns-lookup/ — search the **legal entity name exactly as on the licence**. If the company is listed, write the 9-digit number down. **Done — skip 1b.**
* Dubai licences have often been issued with a D-U-N-S number; look at the licence/renewal papers too.

**1b. If it is not listed — request one (free through Apple's page, paid/faster through D&B UAE)**
* Free route: on Apple's lookup page choose the option to **submit the company to Dun & Bradstreet**. Give: legal entity name (not a trade name), head-office address (Al Ras, Deira, Dubai), mailing address, your work contact. Keep the licence ready — D&B may call. **Up to 5 business days** (Apple says expediting does not shorten the free route); allow **+2 business days** for Apple to receive it.
* Paid/faster route: D&B UAE (CRIF Gulf) registration form https://dnbuae.com/duns-number-registration-form/ · phone **+971 4 406 9900**. They ask for: trade licence copy, Memorandum of Association, shareholder/ownership details, Emirates ID of the authorised signatory, contact details, company stamp. Standard 5–30 business days; expedited about 3–5 business days at an extra charge.
* Important: the name and address on the D-U-N-S record must match the trade licence **character for character** — first settle "LLC" vs "L.L.C" and the building/office spelling (see the checklist), then apply.

## Step 2 — company e-mail addresses (today, ~10 minutes, **you** or whoever manages the dgt.llc mail)
Create at least: `apple@dgt.llc`, `play@dgt.llc`, `support@dgt.llc` (the domain already has mailboxes). Apple will not accept Gmail for an organisation; Samsung and Google prefer a company address. Turn on 2-step verification for each.

## Step 3 — start the three registrations in parallel (same day as Step 1; none of them needs to wait for the D-U-N-S to *begin*)
| Store | Start here | What you do | Fee |
|---|---|---|---|
| **Apple** (longest, so first) | https://developer.apple.com/programs/enroll/ | Sign in with an Apple ID made with `apple@dgt.llc` (2-factor on) → **Organization** → legal name, D-U-N-S, website `https://dgt.llc`, phone. Apple **telephones** you to verify. | USD 99 / year |
| **Google Play** | https://play.google.com/console/signup | Google account `play@dgt.llc` → **Organization** → D-U-N-S, address, phone, website → pay → identity + company document check | USD 25 once |
| **Samsung** | https://account.samsung.com then https://seller.samsungapps.com/ | Create the Samsung account with a company e-mail → apply as **Commercial Seller** (needs D-U-N-S and a company bank account) | free to register |
The person who registers becomes the permanent account owner — use the authorised director. Passwords and 2-step codes stay with you; never send them in chat.

## Step 4 — tell me (one short message)
1. The D-U-N-S number (or the date D&B said it will arrive). 2. Licence spelling: "LLC" or "L.L.C"; address "Al Hathoor Bldg, Office 2-01" or "Al Hathboor Bldg, Office No. 201". 3. Support e-mail and phone to show in the store. 4. When each registration is submitted (date) and any message the stores send ("needs more documents").
I will then put those details into every listing and keep the schedule current.

## Step 5 — decisions I need from you (a single yes/no each)
* Approve the **icons / feature graphics** (`DGT-Mobile-Apps\Store-graphics`) and the **privacy page text**.
* Approve a **reviewer login** for the stores' reviewers (a least-privilege Production account with no extra business data).
* Approve a **Production deployment window** (privacy page + device-approval backend + its migration) — separate approval, after my final tests. Needed before Google/Samsung/Apple review can open the apps' first screen.
* Whether to **rent a cloud Mac** (about one day of work) for the iPhone/iPad build, or you will provide a Mac.
* The pending security approvals (branch switch to `production`, the two unused SSH keys, GitHub protection of `production`).

## Step 6 — your Samsung phone test (I will send the file once built; 20 minutes)
See `DGT-Mobile-Apps\SAMSUNG-TEST-STEPS.txt`. It tests the activation screen, your approval on the PC, the activation code and sign-in, on a real phone.

## What I do while you do the above
Finish the 191-menu sweep and fixes · final signed Android bundles · store screenshots · rebuild release files · keep the deployment plan, gate and rollback ready · prepare the iPhone/iPad build so it can be produced the day Apple approves the account.

## Realistic timeline if you start tomorrow (Sun 11 Oct) and a D-U-N-S already exists
Google registered ≈ 21 Oct → submit 22 Oct → live ≈ 25–29 Oct · Samsung approved ≈ 28 Oct → submit 29 Oct · Apple enrolled ≈ 24 Oct–7 Nov → submit ≈ 5 Nov. If a new D-U-N-S is needed, add ≈ 5–30 business days to all three; Apple/Google/Samsung then start from the day the number is active.
