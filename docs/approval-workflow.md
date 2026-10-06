# Approval Workflow

## Actions Requiring Approval

- edit
- delete
- update
- reverse
- lock
- unlock

Approval can also be used for:

- journal edits.
- ledger edits.
- USD rate edits.
- payment edits.
- sales/purchase edits.
- record reversals.
- soft deletes.

## Status Flow

```text
draft -> pending -> approved -> applied
draft -> pending -> rejected
approved -> cancelled
```

## Tables

- `approval_requests`
- `approval_request_items`
- `approval_status_history`
- `record_locks`

## Approval Request Data

Each request stores:

- action.
- target table.
- target record id.
- country and branch scope.
- before values.
- proposed after values.
- reason.
- status.
- requested by.
- approved/rejected by.
- decision date.
- audit metadata.

## Record Locking

Sensitive records can be locked while approval is pending. Locked records cannot be edited until approved, rejected, unlocked, or cancelled.

## Soft Delete

No permanent delete is allowed for important business records. Delete requests become:

1. Approval request.
2. Soft delete update.
3. `soft_delete_logs`.
4. `audit_logs`.
5. `record_change_history`.

