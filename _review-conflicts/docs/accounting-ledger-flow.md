# Accounting, Ledger, and Roznamcha Flow

## Ledger Structure

Ledger scopes:

- `super_admin`: global ledgers in USD.
- `country`: country ledgers in local currency and USD reporting.
- `main_branch`: main branch ledgers under a country.
- `city_branch`: city branch ledgers.

Ledger categories:

- Cash
- USD Cash
- Bank
- Accounts Receivable
- Accounts Payable
- Expense
- Income
- Equity
- Inventory

## Double-Entry Rule

Every posted accounting event must satisfy:

```text
total debit = total credit
```

No unbalanced entry can be posted. Reversal does not delete the old entry; it creates a reversal journal and links it through `journal_reversals`.

## Journal Flow

1. Create draft `journal_entries`.
2. Add `journal_lines`.
3. Validate line side: debit or credit, not both.
4. Validate totals.
5. If sensitive, create `approval_requests`.
6. On approval, post through database transaction.
7. Insert `ledger_entries`.
8. Update `ledger_balances`.
9. Write `audit_logs` and `record_change_history`.

## Roznamcha Flow

Roznamcha types:

- Super Admin Roznamcha.
- Country Roznamcha.
- Branch Roznamcha.

Payment entry types:

- cash_payment
- cash_receipt
- bank_cheque
- bank_deposit
- transfer
- debit
- credit

Flow:

1. Generate voucher number using `voucher_sequences`.
2. Create `roznamcha_entries`.
3. Add debit/credit lines in `roznamcha_lines`.
4. Validate balanced amounts.
5. Send to approval if required.
6. Post to journal and ledger.
7. Store audit trail.

## USD Conversion

Country entries remain in local currency. USD reporting uses:

- `daily_usd_rates`
- `currency_rates`
- stored USD amount snapshots on business transactions

Global reports must use USD.

