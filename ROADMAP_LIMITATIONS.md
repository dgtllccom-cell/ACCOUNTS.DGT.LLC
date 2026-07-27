# 🗺️ Digital Dock ERP — Known Limitations & Future Roadmap

**Document Version**: 1.0.0 (Post-v1.0.0 Baseline)  
**Scope**: Maintenance Policies, Operational Limitations, and Controlled Enhancement Roadmap  

---

## 1. Governance & Change Control Policy

Following the `v1.0.0` Release Baseline:
- **Strict Maintenance Window**: Only bug fixes, patch updates, and controlled improvements are permitted on the core ERP codebase.
- **Architectural Freeze**: Major architectural changes or backend rewrites (such as Laravel Migration) are placed on hold until explicit written user authorization.

---

## 2. Operational Limitations & Maintenance Recommendations

| Item / Boundary | Operational Guidance | Recommendation |
| :--- | :--- | :--- |
| **Idempotency Log Pruning** | The `idempotency_keys` table stores composite locks and response replays. | Run periodic monthly cleanup: `DELETE FROM public.idempotency_keys WHERE expires_at < NOW() - INTERVAL '30 days'`. |
| **Print Customization Logos** | Print templates default to standard company headers. | Custom corporate logos or letterheads can be added anytime in `public/brand/` or updated in `components/reports/`. |
| **Server Swap Space** | VPS uses 2GB swap file (`/swapfile`). | Keep swap space allocated on Linux server to prevent memory spikes during Next.js builds. |

---

## 3. Future Enhancement Roadmap (Phase 2 & Beyond)

### Priority A: Enhanced Analytics & Audit Trail UI
- Advanced audit trail visual log viewer for tracking order history edits across branches.
- Export to Excel/CSV for custom financial reconciliation reports.

### Priority B: Automated Database Maintenance Jobs
- Scheduled Supabase cron extension to automatically prune expired idempotency locks older than 30 days.

### Priority C: Framework Migration Evaluation (Laravel / Next.js Parallel Execution)
- Future evaluation criteria for any potential framework additions:
  1. Complete feature parity with `v1.0.0` Next.js ERP.
  2. Zero downtime or data loss during migration.
  3. Formal user authorization and approval before initiation.
