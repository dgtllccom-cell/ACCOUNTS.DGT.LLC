import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";

/**
 * Per-leg cargo/marine insurance for Customer Orders, built on the pre-existing
 * clearing_order_insurance_policies table (backfilled in
 * supabase/migrations/20261218_customer_order_insurance.sql).
 *
 * Deliberately reuses the EXISTING approve/post/pay pipeline already built and
 * E2E-verified for external partner bills (approveAndPostPartnerBill,
 * recordPartnerBillPayment in clearing-partner-bill-service.ts) instead of a
 * parallel accounting path: those functions operate generically on a
 * clearing_payment_bills row (provider_account_id/expense_account_id/
 * total_amount/posting_status) and don't care whether the bill originated from
 * a partner-bill creation or an insurance-premium creation. Only bill
 * CREATION is insurance-specific (createInsurancePremiumBill below), because
 * a policy — unlike a partner bill — is optionally tied to a RANGE of legs
 * (from_leg_no..to_leg_no), not always a single leg.
 */

export interface InsurancePolicyInput {
  orderId: string;
  insurerName: string;
  insurerAccountId?: string | null;
  policyNo: string;
  coveredCargo: string;
  insuredValue: number;
  currency: string;
  coverageFrom: string;
  coverageTo: string;
  territory?: string | null;
  fromLegNo: number;
  toLegNo: number;
  premiumAmount?: number | null;
  premiumCurrency?: string | null;
  remarks?: string | null;
}

export interface OrderScope {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  isSuperAdmin?: boolean;
}

function isUniqueViolation(err: any): boolean {
  return err?.code === "23505";
}

/**
 * Lists insurance policies for an order, each joined to its premium bill (if
 * one has been created) so the UI can show payable/posted/paid state without
 * a second round trip.
 */
export async function listInsurancePoliciesForOrder(orderId: string) {
  return withLocalPg(async (sql) => {
    const policies = await sql`
      SELECT
        p.*,
        ins_acc.code AS insurer_account_code, ins_acc.name AS insurer_account_name,
        b.id AS bill_id, b.bill_no, b.posting_status, b.payment_status,
        b.paid_amount, b.remaining_balance, b.total_amount AS bill_total_amount,
        b.roznamcha_entry_id
      FROM public.clearing_order_insurance_policies p
      LEFT JOIN public.ledgers ins_acc ON ins_acc.id = p.insurer_account_id AND ins_acc.deleted_at IS NULL
      LEFT JOIN public.clearing_payment_bills b ON b.insurance_policy_id = p.id AND b.deleted_at IS NULL
      WHERE p.order_id = ${orderId}::uuid AND p.deleted_at IS NULL
      ORDER BY p.from_leg_no ASC, p.created_at ASC
    `;

    const billIds = policies.map((p: any) => p.bill_id).filter(Boolean);
    let payments: any[] = [];
    if (billIds.length > 0) {
      payments = await sql`
        SELECT pay.*, pay_acc.code AS payment_account_code, pay_acc.name AS payment_account_name
        FROM public.clearing_payment_bill_payments pay
        LEFT JOIN public.ledgers pay_acc ON pay_acc.id = pay.payment_account_id AND pay_acc.deleted_at IS NULL
        WHERE pay.bill_id = ANY(${billIds}::uuid[]) AND pay.deleted_at IS NULL
        ORDER BY pay.payment_date ASC, pay.payment_serial ASC
      `;
    }

    return policies.map((p: any) => ({
      ...p,
      payments: payments.filter((pay: any) => pay.bill_id === p.bill_id),
    }));
  });
}

/**
 * Creates or updates an insurance policy. Validates the leg range against the
 * order's REAL legs (not just from_leg_no <= to_leg_no in isolation), the
 * insurer ledger (if provided) is active in Account Master, dates are sane,
 * and insured value is positive. Never invents a value.
 */
export async function createOrUpdateInsurancePolicy(input: InsurancePolicyInput, actorId: string, policyId?: string | null) {
  return withLocalPg(async (sql) => {
    const [order] = await sql`
      SELECT id, order_no, country_id, country_branch_id, city_branch_id
      FROM public.clearing_customer_orders
      WHERE id = ${input.orderId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!order) throw new ApiClientError("Customer order not found.", { status: 404, code: "ORDER_NOT_FOUND" });

    const legs = await sql`
      SELECT leg_no FROM public.clearing_customer_order_legs
      WHERE order_id = ${input.orderId}::uuid AND deleted_at IS NULL
      ORDER BY leg_no ASC
    `;
    const legNos = legs.map((l: any) => Number(l.leg_no));
    if (legNos.length === 0) {
      throw new ApiClientError("This order has no route legs to insure yet.", { status: 400, code: "NO_LEGS" });
    }
    const fromLegNo = Number(input.fromLegNo);
    const toLegNo = Number(input.toLegNo);
    if (toLegNo < fromLegNo) {
      throw new ApiClientError("The coverage end leg must be the same as or after the start leg.", { status: 400, code: "INVALID_LEG_RANGE" });
    }
    if (!legNos.includes(fromLegNo) || !legNos.includes(toLegNo)) {
      throw new ApiClientError(
        `Leg range ${fromLegNo}-${toLegNo} does not match this order's actual legs (${legNos.join(", ")}).`,
        { status: 400, code: "INVALID_LEG_RANGE" }
      );
    }
    if (!(Number(input.insuredValue) > 0)) {
      throw new ApiClientError("Insured value must be greater than zero.", { status: 400, code: "INVALID_INSURED_VALUE" });
    }
    if (new Date(input.coverageTo) < new Date(input.coverageFrom)) {
      throw new ApiClientError("Coverage end date must be on or after the coverage start date.", { status: 400, code: "INVALID_DATES" });
    }
    if (input.insurerAccountId) {
      const [ledger] = await sql`SELECT id, is_active FROM public.ledgers WHERE id = ${input.insurerAccountId}::uuid AND deleted_at IS NULL`;
      if (!ledger) throw new ApiClientError("Insurer account was not found in Account Master.", { status: 404, code: "INSURER_ACCOUNT_NOT_FOUND" });
      if (ledger.is_active === false) throw new ApiClientError("The insurer ledger account is inactive.", { status: 400, code: "INSURER_ACCOUNT_INACTIVE" });
    }

    try {
      if (policyId) {
        const [updated] = await sql`
          UPDATE public.clearing_order_insurance_policies SET
            insurer_name = ${input.insurerName.trim()},
            insurer_account_id = ${input.insurerAccountId || null},
            policy_no = ${input.policyNo.trim()},
            covered_cargo = ${input.coveredCargo.trim()},
            insured_value = ${Number(input.insuredValue)},
            currency = ${input.currency},
            coverage_from = ${input.coverageFrom},
            coverage_to = ${input.coverageTo},
            territory = ${input.territory || null},
            from_leg_no = ${fromLegNo},
            to_leg_no = ${toLegNo},
            premium_amount = ${input.premiumAmount != null ? Number(input.premiumAmount) : null},
            premium_currency = ${input.premiumCurrency || input.currency},
            remarks = ${input.remarks || null},
            updated_at = now()
          WHERE id = ${policyId}::uuid AND order_id = ${input.orderId}::uuid AND deleted_at IS NULL
          RETURNING *
        `;
        if (!updated) throw new ApiClientError("Insurance policy not found.", { status: 404, code: "POLICY_NOT_FOUND" });
        return updated;
      }

      const [inserted] = await sql`
        INSERT INTO public.clearing_order_insurance_policies (
          order_id, insurer_name, insurer_account_id, policy_no, covered_cargo,
          insured_value, currency, coverage_from, coverage_to, territory,
          from_leg_no, to_leg_no, premium_amount, premium_currency, remarks,
          status, country_id, country_branch_id, city_branch_id, created_by
        ) VALUES (
          ${input.orderId}::uuid, ${input.insurerName.trim()}, ${input.insurerAccountId || null}, ${input.policyNo.trim()}, ${input.coveredCargo.trim()},
          ${Number(input.insuredValue)}, ${input.currency}, ${input.coverageFrom}, ${input.coverageTo}, ${input.territory || null},
          ${fromLegNo}, ${toLegNo}, ${input.premiumAmount != null ? Number(input.premiumAmount) : null}, ${input.premiumCurrency || input.currency}, ${input.remarks || null},
          'active', ${order.country_id}, ${order.country_branch_id}, ${order.city_branch_id}, ${actorId}::uuid
        )
        RETURNING *
      `;
      return inserted;
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        throw new ApiClientError("A policy with this insurer and policy number already exists on this order.", { status: 409, code: "DUPLICATE_POLICY" });
      }
      throw err;
    }
  });
}

/** Cancels a policy (soft state, not a delete — mirrors the table's own status CHECK). */
export async function cancelInsurancePolicy(policyId: string, orderId: string) {
  return withLocalPg(async (sql) => {
    const [updated] = await sql`
      UPDATE public.clearing_order_insurance_policies
      SET status = 'cancelled', updated_at = now()
      WHERE id = ${policyId}::uuid AND order_id = ${orderId}::uuid AND deleted_at IS NULL
      RETURNING *
    `;
    if (!updated) throw new ApiClientError("Insurance policy not found.", { status: 404, code: "POLICY_NOT_FOUND" });
    return updated;
  });
}

/**
 * Creates the payable bill for a policy's premium. Deliberately does NOT post
 * or touch any ledger balance — approveAndPostPartnerBill (imported by the
 * caller from clearing-partner-bill-service) does that, generically, exactly
 * as it already does for external partner bills.
 */
export async function createInsurancePremiumBill(policyId: string, actorId: string) {
  return withLocalPg(async (sql) => {
    const [policy] = await sql`
      SELECT * FROM public.clearing_order_insurance_policies WHERE id = ${policyId}::uuid AND deleted_at IS NULL
    `;
    if (!policy) throw new ApiClientError("Insurance policy not found.", { status: 404, code: "POLICY_NOT_FOUND" });
    if (!policy.insurer_account_id) {
      throw new ApiClientError("Register an Account Master ledger for the insurer before creating a premium bill.", { status: 400, code: "INSURER_ACCOUNT_REQUIRED" });
    }
    if (!(Number(policy.premium_amount) > 0)) {
      throw new ApiClientError("Set a premium amount greater than zero before creating a bill.", { status: 400, code: "INVALID_PREMIUM" });
    }

    const [existing] = await sql`
      SELECT id FROM public.clearing_payment_bills WHERE insurance_policy_id = ${policyId}::uuid AND deleted_at IS NULL LIMIT 1
    `;
    if (existing) throw new ApiClientError("A premium bill already exists for this policy.", { status: 409, code: "BILL_ALREADY_EXISTS" });

    const [order] = await sql`
      SELECT id, order_no, country_id, country_branch_id, city_branch_id
      FROM public.clearing_customer_orders WHERE id = ${policy.order_id}::uuid AND deleted_at IS NULL
    `;
    if (!order) throw new ApiClientError("Customer order not found.", { status: 404, code: "ORDER_NOT_FOUND" });

    // A single-leg policy attaches directly to that leg; a multi-leg range is
    // linked via insurance_policy_id + order_id only (leg_id stays null, same
    // as how a partner bill's leg_id is already nullable).
    let legId: string | null = null;
    if (policy.from_leg_no === policy.to_leg_no) {
      const [leg] = await sql`
        SELECT id FROM public.clearing_customer_order_legs
        WHERE order_id = ${policy.order_id}::uuid AND leg_no = ${policy.from_leg_no} AND deleted_at IS NULL
      `;
      legId = leg?.id ?? null;
    }

    const year = new Date().getFullYear();
    const countRows = await sql`SELECT count(*)::int AS c FROM public.clearing_payment_bills`;
    const serial = String((countRows[0]?.c || 0) + 1).padStart(4, "0");
    const billNo = `CL-INSUR-${year}-${serial}`;
    const totalAmount = Number(policy.premium_amount);
    const currency = policy.premium_currency || policy.currency;

    const [bill] = await sql`
      INSERT INTO public.clearing_payment_bills (
        order_id, leg_id, insurance_policy_id, country_id, country_branch_id, city_branch_id,
        bill_no, order_no, agent_name, provider_account_id,
        invoice_ref, expense_category, country_of_service,
        total_amount, paid_amount, remaining_balance, currency_code, exchange_rate,
        payment_status, posting_status, remarks, supporting_documents, is_active, status, created_by
      ) VALUES (
        ${policy.order_id}::uuid, ${legId ? sql`${legId}::uuid` : null}, ${policyId}::uuid,
        ${order.country_id}, ${order.country_branch_id}, ${order.city_branch_id},
        ${billNo}, ${order.order_no}, ${policy.insurer_name}, ${policy.insurer_account_id}::uuid,
        ${policy.policy_no}, 'insurance_premium', ${policy.territory || "International"},
        ${totalAmount}, 0, ${totalAmount}, ${currency}, 1,
        'pending', 'unposted', ${"Insurance premium for policy " + policy.policy_no}, '[]'::jsonb, true, 'active', ${actorId}::uuid
      )
      RETURNING *
    `;
    return bill;
  });
}

/**
 * Real, queryable exceptions — no fabricated alert text, every row traces back
 * to an actual order/leg/policy. Two kinds:
 *  - a leg is flagged insurance_required but no ACTIVE, currently-in-coverage
 *    policy spans it (missing policy)
 *  - an active policy's coverage_to is within 14 days or already past (expiring/expired)
 *
 * Scoped in SQL (not just re-filtered client-side) the same way
 * clearing-customer-order-scope.ts scopes orders: super admins see everything,
 * everyone else only sees rows whose order matches their country/branch scope.
 */
export async function getInsuranceAlerts(scope: OrderScope) {
  return withLocalPg(async (sql) => {
    const scopeClause = scope.isSuperAdmin
      ? sql`true`
      : sql`(
          (${scope.cityBranchId ?? null}::uuid IS NOT NULL AND o.city_branch_id = ${scope.cityBranchId ?? null}::uuid)
          OR (${scope.countryBranchId ?? null}::uuid IS NOT NULL AND o.country_branch_id = ${scope.countryBranchId ?? null}::uuid)
          OR (${scope.countryId ?? null}::uuid IS NOT NULL AND o.country_id = ${scope.countryId ?? null}::uuid)
        )`;

    const missingPolicy = await sql`
      SELECT
        o.id AS order_id, o.order_no, o.country_id, o.country_branch_id, o.city_branch_id,
        l.id AS leg_id, l.leg_no, l.from_country_name, l.to_country_name
      FROM public.clearing_customer_order_legs l
      JOIN public.clearing_customer_orders o ON o.id = l.order_id AND o.deleted_at IS NULL
      WHERE l.deleted_at IS NULL AND l.insurance_required = true
        AND ${scopeClause}
        AND NOT EXISTS (
          SELECT 1 FROM public.clearing_order_insurance_policies p
          WHERE p.order_id = l.order_id AND p.deleted_at IS NULL AND p.status = 'active'
            AND l.leg_no BETWEEN p.from_leg_no AND p.to_leg_no
            AND p.coverage_to >= current_date
        )
      ORDER BY o.created_at DESC
    `;

    const expiringOrExpired = await sql`
      SELECT
        p.id, p.order_id, p.policy_no, p.insurer_name, p.coverage_to, p.from_leg_no, p.to_leg_no,
        o.order_no, o.country_id, o.country_branch_id, o.city_branch_id,
        (p.coverage_to < current_date) AS is_expired
      FROM public.clearing_order_insurance_policies p
      JOIN public.clearing_customer_orders o ON o.id = p.order_id AND o.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'active'
        AND p.coverage_to <= (current_date + interval '14 days')
        AND ${scopeClause}
      ORDER BY p.coverage_to ASC
    `;

    return { missingPolicy, expiringOrExpired };
  });
}
