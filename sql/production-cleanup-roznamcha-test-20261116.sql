-- ============================================================================
-- PRODUCTION: cleanup of TODAY'S Cash Roznamcha test records + serial reset to 001
-- Approved by the owner on 2026-11-16 ("cleanup of today's identified test records only").
--
-- Scope (exact, verified read-only on production before writing this file):
--   Roznamcha entries (5), all created 2026-11-16 between 17:58 and 18:55 UTC:
--     c87e9a34-d544-4e5e-97fa-3d4edc47e4f7  V-20261116-9470       cancelled  DR-00000001  (265,000 AED entry)
--     720e1875-4a16-4208-b926-0d3392fe7067  REV-V-20261116-9470   cancelled  (reversal of the row above)
--     16e4c56b-2443-4310-8743-167b5d732c21  V-20261116-YEKX      posted     DR-00000002  (32,000 USD entry)
--     f8bfc422-6e77-41d3-a6bb-40cdd6ba6417  REV-REV-V-20261116-9470 posted   (reversal of the REV row)
--     e1381fad-f459-4d6a-bd75-ee0a82516314  V-20261116-0LKJ      posted     DR-00000003  (re-post, 265,000 AED)
--   Their 10 roznamcha_lines are NOT deleted; they are excluded from balances because the
--   balance views filter roznamcha_entries.deleted_at IS NULL.
--   Reversal link rows in roznamcha_reversals (2) are kept as audit history.
--   No settlement_transactions rows exist for these entries. No other module references them.
--
-- Serial counters reset to 001 (transaction_serial_sequences, currently next_value = 4 each):
--   ERP (global, roznamcha) · AE (country, roznamcha) · AREAEDU001 (branch, roznamcha)
--   AREAEDU001 (city_branch, roznamcha) · AREMAIN001 (main_branch, roznamcha)
--   DR / ENTRY (roznamcha_debit) · CR / ENTRY (roznamcha_credit)
-- After soft delete the serial unique indexes (WHERE deleted_at IS NULL) no longer contain
-- the old numbers, so new entries start at 001 with no conflict.
--
-- Run as ONE transaction, stopping on the first error (nothing changes if any check fails):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f production-cleanup-roznamcha-test-20261116.sql
-- Backup taken before this file was written: /root/backups/prod-full-before-cleanup-20261116-193322.dump
--   sha256 255b63e1d0d44e95e7754d3c6578cae8ab0553e89fea8cd1b4a607e12564d36d
-- ============================================================================

BEGIN;

-- 0. Preconditions: abort if production is not exactly in the state above.
DO $$
DECLARE n int; ids uuid[] := ARRAY[
  'c87e9a34-d544-4e5e-97fa-3d4edc47e4f7','720e1875-4a16-4208-b926-0d3392fe7067',
  '16e4c56b-2443-4310-8743-167b5d732c21','f8bfc422-6e77-41d3-a6bb-40cdd6ba6417',
  'e1381fad-f459-4d6a-bd75-ee0a82516314']::uuid[];
BEGIN
  SELECT count(*) INTO n FROM public.roznamcha_entries WHERE id = ANY(ids) AND deleted_at IS NULL;
  IF n <> 5 THEN RAISE EXCEPTION 'precondition failed: expected 5 live test entries, found %', n; END IF;

  SELECT count(*) INTO n FROM public.roznamcha_entries WHERE deleted_at IS NULL AND NOT (id = ANY(ids));
  IF n <> 0 THEN RAISE EXCEPTION 'precondition failed: % other live roznamcha entries exist - stop', n; END IF;

  SELECT count(*) INTO n FROM public.roznamcha_lines WHERE roznamcha_entry_id = ANY(ids);
  IF n <> 10 THEN RAISE EXCEPTION 'precondition failed: expected 10 lines on the test entries, found %', n; END IF;

  SELECT count(*) INTO n FROM public.transaction_serial_sequences
   WHERE id IN ('6164cf07-9012-4d4b-a7f0-3713492ff518','bbfba621-50e6-43c8-b62c-1e312dec6446',
                '1446ba9d-4295-44fc-8536-aae1685b12dc','ba8720ee-fc27-4802-ae34-c3c5533bc42a',
                '8a0f7f57-927c-46af-9e42-5d39c9a23a11','07b237a4-12a5-4283-a9d8-b68da152c561',
                '52d15150-d4b9-49a2-85b6-98e5674addd2')
     AND next_value = 4;
  IF n <> 7 THEN RAISE EXCEPTION 'precondition failed: expected 7 roznamcha counters at next_value 4, found %', n; END IF;

  SELECT count(*) INTO n FROM public.settlement_transactions WHERE source_id = ANY(ids);
  IF n <> 0 THEN RAISE EXCEPTION 'precondition failed: settlement rows reference the test entries (%)', n; END IF;
END $$;

-- 1. Audit trail: one record_change_history row per test entry, with the full before-snapshot.
INSERT INTO public.record_change_history (record_table, record_id, country_id, city_branch_id, action, actor_id, before_data, after_data, reason, created_at)
SELECT 'roznamcha_entries', e.id, e.country_id, e.city_branch_id, 'delete', NULL,
       to_jsonb(e),
       jsonb_build_object('deleted_at', now(), 'cleanup', 'owner-approved test cleanup 2026-11-16, serial reset to 001'),
       'Owner-approved cleanup of 16 Nov 2026 test Cash Roznamcha records (no original business record)',
       now()
FROM public.roznamcha_entries e
WHERE e.id IN (
  'c87e9a34-d544-4e5e-97fa-3d4edc47e4f7','720e1875-4a16-4208-b926-0d3392fe7067',
  '16e4c56b-2443-4310-8743-167b5d732c21','f8bfc422-6e77-41d3-a6bb-40cdd6ba6417',
  'e1381fad-f459-4d6a-bd75-ee0a82516314');

-- 2. Soft delete the five test entries. Lines and reversal links stay for the audit trail.
UPDATE public.roznamcha_entries
SET deleted_at = now()
WHERE id IN (
  'c87e9a34-d544-4e5e-97fa-3d4edc47e4f7','720e1875-4a16-4208-b926-0d3392fe7067',
  '16e4c56b-2443-4310-8743-167b5d732c21','f8bfc422-6e77-41d3-a6bb-40cdd6ba6417',
  'e1381fad-f459-4d6a-bd75-ee0a82516314')
  AND deleted_at IS NULL;

-- 3. Reset the seven Roznamcha serial counters so the next allocation is 001.
--    (allocation returns next_value - 1 after the increment: next_value 1 -> 001)
UPDATE public.transaction_serial_sequences
SET next_value = 1, updated_at = now()
WHERE id IN ('6164cf07-9012-4d4b-a7f0-3713492ff518','bbfba621-50e6-43c8-b62c-1e312dec6446',
             '1446ba9d-4295-44fc-8536-aae1685b12dc','ba8720ee-fc27-4802-ae34-c3c5533bc42a',
             '8a0f7f57-927c-46af-9e42-5d39c9a23a11','07b237a4-12a5-4283-a9d8-b68da152c561',
             '52d15150-d4b9-49a2-85b6-98e5674addd2')
  AND next_value = 4;

-- 4. Verification. Any mismatch raises an exception and the whole transaction rolls back.
DO $$
DECLARE n int; dr numeric; cr numeric;
BEGIN
  SELECT count(*) INTO n FROM public.roznamcha_entries WHERE deleted_at IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'verify failed: % live roznamcha entries remain', n; END IF;

  SELECT coalesce(sum(l.debit),0), coalesce(sum(l.credit),0) INTO dr, cr
  FROM public.roznamcha_lines l JOIN public.roznamcha_entries e ON e.id = l.roznamcha_entry_id
  WHERE e.deleted_at IS NULL;
  IF dr <> 0 OR cr <> 0 THEN RAISE EXCEPTION 'verify failed: live roznamcha lines do not net to zero (dr %, cr %)', dr, cr; END IF;

  SELECT count(*) INTO n FROM public.transaction_serial_sequences
   WHERE id IN ('6164cf07-9012-4d4b-a7f0-3713492ff518','bbfba621-50e6-43c8-b62c-1e312dec6446',
                '1446ba9d-4295-44fc-8536-aae1685b12dc','ba8720ee-fc27-4802-ae34-c3c5533bc42a',
                '8a0f7f57-927c-46af-9e42-5d39c9a23a11','07b237a4-12a5-4283-a9d8-b68da152c561',
                '52d15150-d4b9-49a2-85b6-98e5674addd2')
     AND next_value = 1;
  IF n <> 7 THEN RAISE EXCEPTION 'verify failed: serial counters not all at 001 (%)', n; END IF;

  SELECT count(*) INTO n FROM public.record_change_history
   WHERE record_table = 'roznamcha_entries' AND action = 'delete'
     AND reason LIKE 'Owner-approved cleanup of 16 Nov 2026%' AND created_at > now() - interval '1 hour';
  IF n <> 5 THEN RAISE EXCEPTION 'verify failed: expected 5 audit rows, found %', n; END IF;

  SELECT count(*) INTO n FROM public.roznamcha_lines WHERE roznamcha_entry_id IN (
    'c87e9a34-d544-4e5e-97fa-3d4edc47e4f7','720e1875-4a16-4208-b926-0d3392fe7067',
    '16e4c56b-2443-4310-8743-167b5d732c21','f8bfc422-6e77-41d3-a6bb-40cdd6ba6417',
    'e1381fad-f459-4d6a-bd75-ee0a82516314');
  IF n <> 10 THEN RAISE EXCEPTION 'verify failed: test lines changed (% found, expected 10 kept for audit)', n; END IF;
END $$;

COMMIT;
