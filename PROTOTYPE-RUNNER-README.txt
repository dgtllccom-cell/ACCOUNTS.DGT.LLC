DGT ERP FULL UI PROTOTYPE
=========================

WHAT THIS IS
This package runs the existing DGT ERP user interface from the real ERP source code in a protected DESIGN-ONLY mode.

FIRST TIME
1. Extract the whole ZIP/folder.
2. Double-click:
   scripts\INSTALL-FULL-ERP-PROTOTYPE-WINDOWS.cmd
3. Wait while dependencies install.
4. The prototype starts and opens automatically.

NEXT TIME
Double-click:
   scripts\START-FULL-ERP-PROTOTYPE-WINDOWS.cmd

PHONE / IPAD / SAMSUNG
When the black prototype window says READY it also shows:
   http://<computer-ip>:8765/dashboard
Open that address on the phone/tablet while both devices are on the SAME Wi-Fi.
Keep the black prototype window open.

SAFETY
- Production database is not connected in prototype mode.
- Direct Postgres is disabled.
- Supabase is replaced with local no-write prototype data.
- HTTP writes are intercepted/no-op.
- External service credentials are blanked in the prototype process.
- Do not deploy this prototype branch to Production.

SOURCE
Repository: dgtllccom-cell/ACCOUNTS.DGT.LLC
Branch: prototype-full-erp-20261008
