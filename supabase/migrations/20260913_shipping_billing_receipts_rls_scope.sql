-- Defense-in-depth RLS for the shipping billing/receipts tables.
--
-- clearing_bill_customer_charges, customer_receipts and customer_receipt_allocations
-- shipped with a permissive `USING (true)` policy (see 20261122_shipping_billing_receipts_approval.sql).
-- The application's own backend (lib/db/local-postgres.ts) authenticates with the
-- Postgres role embedded in DATABASE_URL and bypasses PostgREST/RLS entirely, so this
-- change has NO effect on the app's own request path or its existing API-layer
-- sessionInDomain()/authorizeApiScope() checks (those remain the primary gate and are
-- unchanged by this migration). RLS here only matters if these tables are ever read or
-- written through a session-aware Supabase client (anon/authenticated key) instead of
-- the privileged writer — exactly the risk already called out and closed for
-- enterprise_accounts/approval_requests in 20260913_account_approval_and_posting_guard.sql.
-- This migration closes the same gap for these three tables, additively and
-- non-destructively: no table, column, or row is altered, only the access policy.
--
-- can_access_country() / can_access_city_branch() (used elsewhere in the app) grant
-- access by geography alone, with no operational_domain awareness — deliberately
-- reused here for their scope-matching logic, but combined with an explicit
-- operational_domain check so this new function is never more permissive than the
-- API's own shipping-domain gate.

CREATE OR REPLACE FUNCTION public.can_access_shipping_scope(
  target_country_id uuid,
  target_city_branch_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.is_active = true
        AND ura.deleted_at IS NULL
        AND ura.operational_domain::text IN ('shipping', 'both')
        AND (
          -- Country-level admin roles: match by country only (mirrors can_access_country).
          (
            ura.role::text IN ('country_admin', 'main_branch_admin')
            AND (target_country_id IS NULL OR ura.country_id = target_country_id)
          )
          OR
          -- Branch-level roles: match by exact city branch when the record has one,
          -- otherwise fall back to country (mirrors can_access_city_branch, extended
          -- to tolerate a country-only scoped row — customer_receipts.city_branch_id
          -- is nullable).
          (
            ura.role::text IN (
              'city_branch_admin', 'accountant', 'cashier', 'agent_user',
              'staff_user', 'auditor_viewer', 'branch_admin', 'staff'
            )
            AND (
              (target_city_branch_id IS NOT NULL AND ura.city_branch_id = target_city_branch_id)
              OR (target_city_branch_id IS NULL AND target_country_id IS NOT NULL AND ura.country_id = target_country_id)
            )
          )
        )
    );
$$;

-- customer_receipts: carries country_id/city_branch_id directly.
DROP POLICY IF EXISTS customer_receipts_all_policy ON public.customer_receipts;
CREATE POLICY customer_receipts_scope_select ON public.customer_receipts
  FOR SELECT USING (public.can_access_shipping_scope(country_id, city_branch_id));
CREATE POLICY customer_receipts_scope_insert ON public.customer_receipts
  FOR INSERT WITH CHECK (public.can_access_shipping_scope(country_id, city_branch_id));
CREATE POLICY customer_receipts_scope_update ON public.customer_receipts
  FOR UPDATE
  USING (public.can_access_shipping_scope(country_id, city_branch_id))
  WITH CHECK (public.can_access_shipping_scope(country_id, city_branch_id));
CREATE POLICY customer_receipts_scope_delete ON public.customer_receipts
  FOR DELETE USING (is_super_admin());

-- clearing_bill_customer_charges: scope lives on the parent bill.
DROP POLICY IF EXISTS clearing_bill_customer_charges_all_policy ON public.clearing_bill_customer_charges;
CREATE POLICY clearing_bill_customer_charges_scope_select ON public.clearing_bill_customer_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clearing_payment_bills b
      WHERE b.id = bill_id AND public.can_access_shipping_scope(b.country_id, b.city_branch_id)
    )
  );
CREATE POLICY clearing_bill_customer_charges_scope_insert ON public.clearing_bill_customer_charges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clearing_payment_bills b
      WHERE b.id = bill_id AND public.can_access_shipping_scope(b.country_id, b.city_branch_id)
    )
  );
CREATE POLICY clearing_bill_customer_charges_scope_update ON public.clearing_bill_customer_charges
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clearing_payment_bills b
      WHERE b.id = bill_id AND public.can_access_shipping_scope(b.country_id, b.city_branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clearing_payment_bills b
      WHERE b.id = bill_id AND public.can_access_shipping_scope(b.country_id, b.city_branch_id)
    )
  );
CREATE POLICY clearing_bill_customer_charges_scope_delete ON public.clearing_bill_customer_charges
  FOR DELETE USING (is_super_admin());

-- customer_receipt_allocations: scope lives on the parent receipt.
DROP POLICY IF EXISTS customer_receipt_allocations_all_policy ON public.customer_receipt_allocations;
CREATE POLICY customer_receipt_allocations_scope_select ON public.customer_receipt_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_id AND public.can_access_shipping_scope(r.country_id, r.city_branch_id)
    )
  );
CREATE POLICY customer_receipt_allocations_scope_insert ON public.customer_receipt_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_id AND public.can_access_shipping_scope(r.country_id, r.city_branch_id)
    )
  );
CREATE POLICY customer_receipt_allocations_scope_update ON public.customer_receipt_allocations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_id AND public.can_access_shipping_scope(r.country_id, r.city_branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_id AND public.can_access_shipping_scope(r.country_id, r.city_branch_id)
    )
  );
CREATE POLICY customer_receipt_allocations_scope_delete ON public.customer_receipt_allocations
  FOR DELETE USING (is_super_admin());
