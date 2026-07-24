# Database ERD

## High-Level Entity Map

```text
profiles
  -> user_role_assignments
      -> countries
      -> country_branches
      -> city_branches

countries
  -> states_provinces
      -> cities
          -> areas_locations
  -> country_branches
      -> city_branches
  -> currency_rates
  -> daily_usd_rates
  -> transactions
  -> reports

accounts
  -> ledgers
      -> ledger_balances
      -> ledger_entries

journal_entries
  -> journal_lines
  -> ledger_entries
  -> journal_reversals

roznamcha_entries
  -> roznamcha_lines
      -> accounts
      -> ledgers

approval_requests
  -> approval_request_items
  -> approval_status_history
  -> record_locks

languages
  -> user_language_preferences
  -> translation_keys
      -> translation_values
  -> record_translations

management_categories
  -> management_parameters
      -> management_parameter_values

erp_modules
  -> module_dependencies
  -> module_settings
  -> module_number_sequences
  -> module_audit_rules
```

## Key Relationships

- One country has one active main branch in `country_branches`.
- One country has many city branches in `city_branches`.
- City branch creation must always include country and main branch.
- User scope is stored in `user_role_assignments`.
- Financial records carry country and branch identifiers for security and reporting.
- Global reports convert local values to USD using stored exchange rates.
- Approval requests reference records generically using `target_table` and `target_id`.
- Translation records reference any table generically using `record_table`, `record_id`, and `field_name`.

## Security Boundary

Super Admin:

- Global access.

Country Admin:

- `country_id` scoped access.

Main Branch Admin:

- `country_id` and `country_branch_id` scoped access.

City Branch Admin:

- `city_branch_id` scoped access.

Staff/Agent:

- Assigned scope only.

