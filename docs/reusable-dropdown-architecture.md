# Reusable Dropdown Architecture

## Goal

Dropdowns must come from reusable master data instead of hardcoded screen-only arrays.

## Sources

Primary reusable tables:

- `management_categories`
- `management_parameters`
- `management_parameter_values`
- `countries`
- `states_provinces`
- `cities`
- `areas_locations`
- `payment_methods`
- `languages`
- `erp_role_templates`

## Dropdown Types

Static system dropdowns:

- Roles.
- Approval statuses.
- Ledger scopes.
- Roznamcha types.
- Language list.

Management dropdowns:

- Document Type.
- Contract Type.
- Customer Type.
- Supplier Type.
- Agent Type.
- Payment Method.
- Container Type.
- Vessel Type.

Dependent dropdowns:

- Country -> State/Province -> City -> Area.
- Country -> Main Branch -> City Branch.
- Module -> Report Definition.
- Role -> Permission Group.

## Dropdown Component Contract

Reusable dropdown components should accept:

- `source`
- `parameterCode`
- `countryId`
- `parentValueId`
- `value`
- `onChange`
- `allowCreate`
- `disabled`
- `languageCode`

## Create-New Flow

When `allowCreate` is true:

1. User clicks `New`.
2. Modal opens.
3. Parent scope is shown at the top.
4. Duplicate check runs case-insensitively.
5. New value is saved.
6. Dropdown auto-selects the saved value.
7. Audit log is written.

## Multilingual Dropdown Labels

Dropdown labels should read from:

- `translation_values` for system labels.
- `record_translations` for user-created values.

Fallback order:

1. User preferred language.
2. English.
3. Original text.

