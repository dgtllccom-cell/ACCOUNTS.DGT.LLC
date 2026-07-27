# 🚀 Digital Dock ERP — Official Release Notes (v1.0.0)

**Version**: `v1.0.0` (Stable Production Baseline)  
**Release Date**: July 27, 2026  
**Git Tag**: `v1.0.0`  
**Git Commit Hash**: `c5e88dfa9`  
**Target Environment**: Hostinger VPS (`72.60.209.121`) / Supabase PostgreSQL  

---

## 🌟 Executive Summary

Digital Dock ERP Release `v1.0.0` represents the official, production-grade, baseline release of the global accounting and inventory management enterprise software. All direct accounting posting APIs, double-entry ledger calculations, multi-tenant isolation rules, print reporting engines, and database migrations have been fully audited, tested, and verified on live production servers.

---

## 🔥 Key Release Features & Improvements

### 1. System-Wide Idempotency Framework
- **Multi-Tenant Composite Lock Hashing**: Unique SHA256 hashes generated from `User ID` + `Country ID` + `City Branch ID` + `Module Scope` + `Business Reference` + `Payload Hash`.
- **Duplicate Posting Protection**: Protects all 9 Direct Posting APIs against network retries, double-clicks, and concurrent duplicate requests.
- **Stale Lock Auto-Recovery**: Stale processing locks automatically expire after 90 seconds, enabling smooth user recovery without manual database intervention.
- **HTTP Response Replay**: Cached 200/201 HTTP responses are replayed cleanly with an `X-Idempotent-Replayed: true` header.

### 2. Standalone A4 Print Reporting Engine
- **Full Purchase Booking Report (A4)**: 41-column audit view with full breakdowns.
- **Compact Purchase Booking Order**: Streamlined order summary view.
- **A4 Quotation Print**: Official customer quote document.
- **Commercial Invoice (A4)**: Standalone international shipping and export document.
- **Packing List (A4)**: Cargo manifest & container weight specification report.
- **Shipping Invoice (A4)**: Ocean freight and vessel shipment statement.

### 3. Accounting Ledger & Double-Entry Integrity
- **100% DR = CR Balance Validation**: Mandatory checking on all multi-line journal postings (`Debit Total === Credit Total`).
- **Bank & Cash DR/CR Mapping**: Bank payment debit and credit entries are strictly mapped into distinct dedicated columns.
- **Atomic Serial Number Allocation**: Postgres RPC functions generate sequential, collision-free transaction serial numbers (`journal_serial_no`, `country_serial_no`, `branch_serial_no`).

---

## 📂 Protected Direct Posting API Endpoints (v1.0.0)

1. `POST /api/erp/roznamcha` — Manual Cash Entry & Journal Vouchers
2. `POST /api/erp/purchases/orders/[id]/payments` — Purchase Order Payments
3. `POST /api/erp/purchases/orders/[id]/transfer` — Purchase Order Transfer to Roznamcha
4. `POST /api/erp/purchases/local-purchase/transfer` — Local Purchase Transfer
5. `POST /api/erp/purchases/local-purchase/accept` — Local Purchase Acceptance
6. `POST /api/erp/sales/orders/[id]/payments` — Sales Order Payments
7. `POST /api/erp/sales/orders/[id]/transfer` — Sales Order Transfer
8. `POST /api/erp/money-exchange` — Money Exchange Voucher Posting
9. `POST /api/erp/expenses` — Direct Expense Bill Posting

---

## 💾 Migration & Backup Archive

- **Forward Migration**: `supabase/migrations/20260727_idempotency_keys.sql`
- **Rollback Migration**: `supabase/migrations/20260727_idempotency_keys_rollback.sql`
- **Backup & Recovery Guide**: [BACKUP_RECOVERY_GUIDE.md](file:///c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/BACKUP_RECOVERY_GUIDE.md)

---

## 🛠️ Deployment Verification Checklist (v1.0.0)

- [x] All 24 unit & integration tests passing (`tests/api/idempotency.test.ts`).
- [x] TypeScript static compilation clean (0 errors).
- [x] Live HTTP Health Check PASSED on Hostinger VPS (`http://72.60.209.121`).
- [x] Verified on Node 20+, Next.js 15 App Router, PM2 cluster, and Nginx.
