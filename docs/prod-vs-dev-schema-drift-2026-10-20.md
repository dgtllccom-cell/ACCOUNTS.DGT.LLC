# Production vs DEV schema drift — found and partly closed (2026-10-20)

Method: `information_schema.columns` of both databases compared (DEV `csesvyxxjivnkkozgopt`, Production `inmayhrxucimxqhgseqi`), then every difference mapped to its migration file and reviewed. Production error log showed the first symptom: `column t.metadata does not exist` on the Customer Order workflow endpoint.

## Applied to Production on 2026-10-20 (reviewed, additive, backed up first — verified dump `prod-tables-before-20260912-20261221-*.dump`, plus the gate backup of the same day)
| Migration | What | Why |
|---|---|---|
| `20260912_inter_country_transfers_reference_columns` | 10 nullable columns on `inter_country_transfers` (bill/container/order/BL/job refs, claim category, metadata) | Customer Order "Transfer & History" and the Transfer Center selected these columns → HTTP 500 on live. Table had 0 rows |
| `20261221_crm_lead_pipeline` | `customer_inquiries.pipeline_stage` (+4 columns), table `customer_inquiry_pipeline_events`; backfill only sets the NEW column from the row's own status | CRM sales pipeline screens. 1 inquiry row (stage `new_lead`) |
| `truck_loadings.report_payload` (only the `ALTER`, from `20260921_truck_loadings_report_payload`) | 1 jsonb column, default `{}` | Truck Loading form fields were silently discarded without it. Table had 0 rows |

All business-table row counts were unchanged before and after.

## NOT applied — needs a separate decision
| Object (in DEV, missing on Production) | Migration | Why it was left |
|---|---|---|
| `exchange_rate_history.old_/new_ credit/debit rate, user_name` and replacement of `get_daily_rate` and **`post_roznamcha_entry`** | `20261225_daily_exchange_rate_enterprise_audit` | Rewrites the core accounting posting function. Must be tested as a financial change with its own backup and approval |
| `hr_wps_payment_results`, `hr_payroll_run_lines.payment_failure_reason` | `20261222_wps_payment_result_reconciliation` | Payroll/WPS feature outside this release scope |
| `pk_income_tax_returns/events`, `pk_sales_tax_returns/events` | `20261220_pakistan_income_and_sales_tax` | Tax feature outside this release scope |
| `account_warehouses.company_id/customer_id/is_primary`, `warehouses.account_id/company_id` | `20260915_branch_rules_and_account_warehouses`, `20260916_enterprise_account_warehouses` | Creates tables with permissive `using (true)` RLS policies — needs a security review first |
| 8 `zz_bak_20260801_*` tables | (DEV-only backups) | Not needed on Production |

Rule going forward: before any release, run the schema comparison above and either apply the reviewed additive migration or hide the feature.
