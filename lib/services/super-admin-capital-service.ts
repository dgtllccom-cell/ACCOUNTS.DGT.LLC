import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/route";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Super Admin Capital & Investment Service
 * Manages protected owner capital, additional investments, capital returned,
 * owner drawings, and country investment ledger calculations without mixing with operating P&L.
 */

export type CapitalAccountType =
  | "opening_capital"
  | "additional_investment"
  | "capital_returned"
  | "owner_drawings"
  | "annual_profit_loss";

export type CreateCapitalEntryInput = {
  session: ErpSession;
  accountType: CapitalAccountType;
  countryId?: string | null;
  description?: string | null;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  referenceNo?: string | null;
  narration?: string | null;
  financialPeriodId?: string | null;
  debitLedgerId?: string | null;
  creditLedgerId?: string | null;
};

export async function createCapitalEntry(input: CreateCapitalEntryInput) {
  if (!input.session.isSuperAdmin && !input.session.roles?.includes("super_admin")) {
    throw new Error("Unauthorized: Only Super Admin can post capital / investment transactions");
  }

  const currency = input.currency || "USD";
  const rate = Number(input.exchangeRate || 1);
  const baseAmount = Math.round(input.amount * rate * 10000) / 10000;
  const globalRef = `CAP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const row = await withLocalPg(async (sql) => {
    const r = await sql`
      insert into public.super_admin_capital_accounts (
        account_type, country_id, description, amount, currency, exchange_rate,
        base_amount, reference_no, narration, financial_period_id, global_reference_id,
        posted_by, created_by, status
      ) values (
        ${input.accountType}, ${input.countryId || null}, ${input.description || null},
        ${input.amount}, ${currency}, ${rate}, ${baseAmount},
        ${input.referenceNo || null}, ${input.narration || null},
        ${input.financialPeriodId || null}, ${globalRef},
        ${input.session.userId}, ${input.session.userId}, 'posted'
      )
      returning id, global_reference_id
    `;
    return r[0];
  });

  // Post to roznamcha if debit/credit ledgers are provided
  if (input.debitLedgerId && input.creditLedgerId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rozResult = await postRoznamchaWithErpSession({
        sessionUserId: input.session.userId,
        session: input.session,
        body: {
          mode: "post",
          type: "super_admin",
          countryId: input.countryId || undefined,
          entryDate: today,
          journalNo: `JRN-${globalRef}`,
          voucherNo: `VCH-${globalRef}`,
          narration: input.narration || `Super Admin Capital: ${input.accountType}`,
          lines: [
            {
              ledgerId: input.debitLedgerId,
              debit: input.amount,
              credit: 0,
              currency,
              usdRate: rate,
              usdAmount: baseAmount,
              description: `Capital Entry: ${input.accountType} - ${input.description || ""}`,
            },
            {
              ledgerId: input.creditLedgerId,
              debit: 0,
              credit: input.amount,
              currency,
              usdRate: rate,
              usdAmount: baseAmount,
              description: `Capital Entry: ${input.accountType} - ${input.description || ""}`,
            },
          ],
          sourceModule: "super_admin_capital",
          sourceTransactionType: input.accountType,
          sourceTransactionId: (row?.id as string) || "",
          sourceReferenceNo: globalRef,
          originalLanguage: "en",
        } as any,
      });

      if (rozResult?.entryId && row?.id) {
        await withLocalPg(async (sql) => {
          await sql`
            update public.super_admin_capital_accounts
            set roznamcha_entry_id = ${rozResult.entryId}, updated_at = now()
            where id = ${row.id}
          `;
        });
      }
    } catch (e: any) {
      console.warn("[capital-service] roznamcha posting fallback/warning:", e?.message);
    }
  }

  // If country specific, refresh country investment ledger
  if (input.countryId) {
    await recalculateCountryInvestmentLedger(input.countryId, input.financialPeriodId || null);
  }

  return { id: row?.id ?? "", globalReferenceId: row?.global_reference_id ?? globalRef };
}

export async function recalculateCountryInvestmentLedger(countryId: string, financialPeriodId: string | null) {
  return await withLocalPg(async (sql) => {
    // 1. Sum up capital movements
    const capRows = await sql`
      select account_type, coalesce(sum(base_amount), 0) as total
      from public.super_admin_capital_accounts
      where country_id = ${countryId}
        and status = 'posted'
        and deleted_at is null
        ${financialPeriodId ? sql`and financial_period_id = ${financialPeriodId}` : sql``}
      group by account_type
    `;

    let openingInvestment = 0;
    let additionalInvestment = 0;
    let capitalReturned = 0;
    let annualPl = 0;

    for (const r of capRows) {
      const amt = Number(r.total || 0);
      if (r.account_type === "opening_capital") openingInvestment += amt;
      else if (r.account_type === "additional_investment") additionalInvestment += amt;
      else if (r.account_type === "capital_returned") capitalReturned += amt;
      else if (r.account_type === "annual_profit_loss") annualPl += amt;
    }

    const netInvestment = openingInvestment + additionalInvestment - capitalReturned;

    // 2. Fetch income & expenses for country
    const ledgerStats = await sql`
      select
        coalesce(sum(case when l.normal_balance = 'credit' then l.credit_total - l.debit_total else 0 end), 0) as income,
        coalesce(sum(case when l.normal_balance = 'debit' then l.debit_total - l.credit_total else 0 end), 0) as expense
      from public.ledgers l
      where l.country_id = ${countryId}
        and l.deleted_at is null
    `;

    const incomeTotal = Number(ledgerStats[0]?.income || 0);
    const expenseTotal = Number(ledgerStats[0]?.expense || 0);
    const operatingPl = incomeTotal - expenseTotal;
    const closingPosition = netInvestment + operatingPl;

    // 3. Upsert into country_investment_ledger
    const existing = await sql`
      select id from public.country_investment_ledger
      where country_id = ${countryId}
        ${financialPeriodId ? sql`and financial_period_id = ${financialPeriodId}` : sql`and financial_period_id is null`}
        and deleted_at is null
      limit 1
    `;

    if (existing.length > 0) {
      await sql`
        update public.country_investment_ledger
        set opening_investment = ${openingInvestment},
            additional_investment = ${additionalInvestment},
            capital_returned = ${capitalReturned},
            net_investment = ${netInvestment},
            income_total = ${incomeTotal},
            expense_total = ${expenseTotal},
            annual_profit_loss = ${annualPl || operatingPl},
            closing_position = ${closingPosition},
            last_calculated_at = now(),
            updated_at = now()
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into public.country_investment_ledger (
          country_id, financial_period_id, opening_investment, additional_investment,
          capital_returned, net_investment, income_total, expense_total,
          annual_profit_loss, closing_position, last_calculated_at
        ) values (
          ${countryId}, ${financialPeriodId}, ${openingInvestment}, ${additionalInvestment},
          ${capitalReturned}, ${netInvestment}, ${incomeTotal}, ${expenseTotal},
          ${annualPl || operatingPl}, ${closingPosition}, now()
        )
      `;
    }

    return {
      countryId,
      openingInvestment,
      additionalInvestment,
      capitalReturned,
      netInvestment,
      incomeTotal,
      expenseTotal,
      operatingPl,
      closingPosition,
    };
  });
}

export async function getSuperAdminCapitalSummary() {
  return await withLocalPg(async (sql) => {
    const summary = await sql`
      select
        coalesce(sum(case when account_type = 'opening_capital' then base_amount else 0 end), 0) as total_opening_capital,
        coalesce(sum(case when account_type = 'additional_investment' then base_amount else 0 end), 0) as total_additional_investment,
        coalesce(sum(case when account_type = 'capital_returned' then base_amount else 0 end), 0) as total_capital_returned,
        coalesce(sum(case when account_type = 'owner_drawings' then base_amount else 0 end), 0) as total_owner_drawings,
        coalesce(sum(case when account_type = 'annual_profit_loss' then base_amount else 0 end), 0) as total_annual_pl
      from public.super_admin_capital_accounts
      where status = 'posted' and deleted_at is null
    `;

    const countryBreakdowns = await sql`
      select
        c.id as country_id,
        c.name as country_name,
        c.currency_code,
        coalesce(cil.opening_investment, 0) as opening_investment,
        coalesce(cil.additional_investment, 0) as additional_investment,
        coalesce(cil.capital_returned, 0) as capital_returned,
        coalesce(cil.net_investment, 0) as net_investment,
        coalesce(cil.income_total, 0) as income_total,
        coalesce(cil.expense_total, 0) as expense_total,
        coalesce(cil.annual_profit_loss, 0) as annual_profit_loss,
        coalesce(cil.closing_position, 0) as closing_position
      from public.countries c
      left join public.country_investment_ledger cil on cil.country_id = c.id and cil.deleted_at is null
      where c.deleted_at is null
      order by c.name asc
    `;

    const recentEntries = await sql`
      select saca.*, c.name as country_name, p.full_name as posted_by_name
      from public.super_admin_capital_accounts saca
      left join public.countries c on c.id = saca.country_id
      left join public.profiles p on p.id = saca.posted_by
      where saca.deleted_at is null
      order by saca.created_at desc
      limit 50
    `;

    return {
      summary: summary[0] || {},
      countryBreakdowns: countryBreakdowns || [],
      recentEntries: recentEntries || [],
    };
  });
}
