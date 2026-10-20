# Production vs DEV schema drift — found and partly closed (2026-10-20)

Method: `information_schema.columns` of both databases compared (DEV `csesvyxxjivnkkozgopt`, Production `inmayhrxucimxqhgseqi`), then every difference mapped to its migration file and reviewed. Production error log showed the first symptom: `column t.metadata does not exist` on the Customer Order workflow endpoint.

## Applied to Production on 2026-10-20 (reviewed, additive, backed up first — verified dump `prod-tables-before-20260912-20261221-*.dump`, plus the gate backup of the same day)
| Migration | What | Why |
|---|---|---|
| `20260912_inter_country_transfers_reference_columns` | 10 nullable columns on `inter_country_transfers` (bill/container/order/BL/job refs, claim category, metadata) | Customer Order "Transfer & History" and the Transfer Center selected these columns → HTTP 500 on live. Table had 0 rows |
| `20261221_crm_lead_pipeline` | `customer_inquiries.pipeline_stage` (+4 columns), table `customer_inquiry_pipeline_events`; backfill only sets the NEW column from the row's own status | CRM sales pipeline screens. 1 inquiry row (stage `new_lead`) |
| `truck_loadings.report_payload` (only the `ALTER`, from `20260921_truck_loadings_report_payload`) | 1 jsonb column, default `{}` | Truck Loading form fields were silently discarded without it. Table had 0 rows |
| `20261220_pakistan_income_and_sales_tax` | 4 new tables (pk_income_tax_returns/events, pk_sales_tax_returns/events) | Tax feature tables missing on Production; no existing data touched |
| `20261222_wps_payment_result_reconciliation` | table hr_wps_payment_results (unique per SIF line) + hr_payroll_run_lines.payment_failure_reason | Payroll WPS reconciliation; payroll tables had 0 rows |
| `20260915` section 3 only | warehouses.account_id / company_id (nullable FKs) + 2 partial indexes | Account/company link on warehouses; 1 warehouse row |

Production is NOT simply behind DEV: for get_daily_rate and post_roznamcha_entry the PRODUCTION functions are NEWER than DEV (Production has the effective_from based daily rate from 20261019).

## NOT applied — needs a separate decision
| Object | Migration | Why it was left |
|---|---|---|
| exchange_rate_history old/new rate + user_name columns and the replacement of get_daily_rate and post_roznamcha_entry | 20261225_daily_exchange_rate_enterprise_audit | Production already has a NEWER get_daily_rate and a different 12-argument post_roznamcha_entry than DEV (md5 differs, Production is longer): applying the file would risk reverting Production accounting logic. Needs a three-way merge of the functions and its own financial test |
| account_warehouses.company_id/customer_id/is_primary, branch_rules policies | 20260915 (sections 1, 2, 4, 5), 20260916 | Adds permissive RLS policies (using (true)) for authenticated users; needs a security review. The legacy account_warehouses table has real rows tied to the old accounts table |
| 8 zz_bak_20260801_* tables | DEV-only backups | Not needed on Production |

Rule going forward: before any release run the schema comparison, apply the reviewed additive migration or hide the feature, and never apply a function-rewriting migration to Production without diffing it against the live function first.
