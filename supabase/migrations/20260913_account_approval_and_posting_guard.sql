-- Shared account-master approval and ledger posting guard.
--
-- New enterprise accounts created by a non-approver are stored as
-- pending_approval.  They may have an inactive placeholder ledger for
-- traceability, but no journal/roznamcha line may post against them until an
-- authorised reviewer approves the account.  This is deliberately additive:
-- existing master data and existing active accounts are unchanged.

DO $$
BEGIN
  ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE public.approval_action_type ADD VALUE IF NOT EXISTS 'create';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS approval_requests_accounts_idx
  ON public.approval_requests (target_table, target_id)
  WHERE target_table = 'enterprise_accounts' AND deleted_at IS NULL;

-- Approval decisions are still checked by the API permission middleware, but
-- the database must enforce the same boundary when a session-aware Supabase
-- client is used (for example in DEV without a privileged writer).
CREATE OR REPLACE FUNCTION public.can_approve_erp_scope(
  target_country_id uuid,
  target_city_branch_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role::text IN ('country_admin', 'main_branch_admin', 'accountant')
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
        AND (target_country_id IS NULL OR ura.country_id = target_country_id)
        AND (
          target_city_branch_id IS NULL
          OR ura.city_branch_id = target_city_branch_id
          OR (
            ura.role::text IN ('country_admin', 'main_branch_admin')
            AND EXISTS (
              SELECT 1
              FROM public.city_branches cb
              WHERE cb.id = target_city_branch_id
                AND cb.country_id = ura.country_id
            )
          )
        )
    );
$$;

DROP POLICY IF EXISTS approval_super_admin_write ON public.approval_requests;
DROP POLICY IF EXISTS approval_request_creator_insert ON public.approval_requests;
CREATE POLICY approval_request_creator_insert ON public.approval_requests
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (
      requested_by = auth.uid()
      AND (
        country_id IS NULL
        OR can_access_country(country_id)
      )
      AND (
        city_branch_id IS NULL
        OR can_access_city_branch(city_branch_id)
      )
    )
  );

DROP POLICY IF EXISTS approval_request_approver_update ON public.approval_requests;
CREATE POLICY approval_request_approver_update ON public.approval_requests
  FOR UPDATE
  USING (can_approve_erp_scope(country_id, city_branch_id))
  WITH CHECK (can_approve_erp_scope(country_id, city_branch_id));

DROP POLICY IF EXISTS approval_request_super_admin_delete ON public.approval_requests;
CREATE POLICY approval_request_super_admin_delete ON public.approval_requests
  FOR DELETE
  USING (is_super_admin());

DROP POLICY IF EXISTS record_locks_actor_update ON public.record_locks;
CREATE POLICY record_locks_actor_update ON public.record_locks
  FOR UPDATE
  USING (
    is_super_admin()
    OR locked_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.approval_requests ar
      WHERE ar.id = record_locks.approval_request_id
        AND can_approve_erp_scope(ar.country_id, ar.city_branch_id)
    )
  )
  WITH CHECK (
    is_super_admin()
    OR unlocked_by = auth.uid()
    OR locked_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.assert_enterprise_account_active_for_posting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_account_id uuid;
  resolved_status public.account_status;
BEGIN
  -- Prefer the explicit account reference written by the posting service.
  -- Fall back to the ledger reference so legacy posting code is protected too.
  resolved_account_id := NEW.enterprise_account_id;
  IF resolved_account_id IS NULL AND NEW.ledger_id IS NOT NULL THEN
    SELECT l.enterprise_account_id
      INTO resolved_account_id
      FROM public.ledgers l
     WHERE l.id = NEW.ledger_id;
  END IF;

  IF resolved_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ea.status
    INTO resolved_status
    FROM public.enterprise_accounts ea
   WHERE ea.id = resolved_account_id
     AND ea.deleted_at IS NULL;

  IF resolved_status IS DISTINCT FROM 'active'::public.account_status THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE: enterprise account % has status %',
      resolved_account_id,
      COALESCE(resolved_status::text, 'missing')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_posting_lines_enterprise_account_active_guard
  ON public.ledger_posting_lines;
CREATE TRIGGER ledger_posting_lines_enterprise_account_active_guard
  BEFORE INSERT OR UPDATE OF ledger_id, enterprise_account_id
  ON public.ledger_posting_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_enterprise_account_active_for_posting();

DROP TRIGGER IF EXISTS roznamcha_lines_enterprise_account_active_guard
  ON public.roznamcha_lines;
CREATE TRIGGER roznamcha_lines_enterprise_account_active_guard
  BEFORE INSERT OR UPDATE OF ledger_id, enterprise_account_id
  ON public.roznamcha_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_enterprise_account_active_for_posting();

COMMENT ON FUNCTION public.assert_enterprise_account_active_for_posting() IS
  'Prevents ledger and roznamcha postings against pending or archived enterprise accounts.';

NOTIFY pgrst, 'reload schema';
