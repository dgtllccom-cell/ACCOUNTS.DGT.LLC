import { withLocalPg } from "@/lib/db/local-postgres";
import type { CustomerLedgerReportData, CustomerLedgerRow } from "@/lib/reports/open-customer-ledger-print-report";

export interface CustomerStatementOptions {
  from?: string | null;
  to?: string | null;
}

/**
 * Combined Customer Statement — every roznamcha_lines row posted against ANY
 * of the customer's accounts (business AND shipping enterprise_accounts rows
 * share the same posting engine/ledger table, so one query naturally combines
 * both domains; no separate union of clearing_bill_customer_charges /
 * customer_receipts is needed — those already post through roznamcha_lines).
 */
export async function getCombinedCustomerStatement(
  customerId: string,
  options: CustomerStatementOptions = {}
): Promise<CustomerLedgerReportData> {
  const data = await withLocalPg(async (sql) => {
    const [customer] = await sql`SELECT id, customer_name, person_code, mobile, address FROM public.customers WHERE id = ${customerId} LIMIT 1`;
    if (!customer) throw new Error("Customer not found.");

    const ledgers = await sql`
      SELECT l.id, l.currency, l.name, ea.operational_domain
      FROM public.enterprise_accounts ea
      JOIN public.ledgers l ON l.enterprise_account_id = ea.id AND l.deleted_at IS NULL
      WHERE ea.customer_id = ${customerId} AND ea.deleted_at IS NULL
    `;
    const ledgerIds = ledgers.map((l: any) => l.id);
    if (ledgerIds.length === 0) {
      return { customer, ledgers, lines: [] as any[] };
    }

    const from = options.from ?? "1970-01-01";
    const to = options.to ?? "2999-12-31";

    const lines = await sql`
      SELECT
        rl.id AS line_id, rl.debit, rl.credit, rl.currency, rl.description, rl.ledger_id,
        re.entry_date, re.voucher_no, re.journal_no, re.narration, re.source_module,
        re.city_branch_id, cb.name AS branch_name
      FROM public.roznamcha_lines rl
      JOIN public.roznamcha_entries re ON re.id = rl.roznamcha_entry_id AND re.deleted_at IS NULL
      LEFT JOIN public.city_branches cb ON cb.id = re.city_branch_id
      WHERE rl.ledger_id = ANY(${ledgerIds}::uuid[])
        AND re.entry_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY re.entry_date ASC, re.created_at ASC
    `;
    return { customer, ledgers, lines };
  });

  if (!data) throw new Error("Customer statement needs a direct database connection.");
  const { customer, ledgers, lines } = data;

  let running = 0;
  const rows: CustomerLedgerRow[] = lines.map((line: any, i: number) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    running += debit - credit;
    return {
      srNo: i + 1,
      date: line.entry_date,
      branchEntryNo: line.voucher_no || line.journal_no || "-",
      userName: "",
      branchName: line.branch_name || "-",
      roznamachaNameAndNo: line.source_module ? `${line.source_module} / ${line.voucher_no}` : `Roznamcha / ${line.voucher_no}`,
      remarks: line.description || line.narration || "",
      debit,
      credit,
      balance: running,
      dcType: (running >= 0 ? "Dr" : "Cr") as "Dr" | "Cr",
      origCurrency: line.currency
    };
  });

  const totalDebit = rows.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);
  const closingBalance = totalDebit - totalCredit;
  const currency = ledgers[0]?.currency || "USD";

  return {
    customerName: customer.customer_name,
    customerCode: customer.person_code || customer.id.slice(0, 8),
    phone: customer.mobile ?? undefined,
    address: customer.address ?? undefined,
    openingBalance: 0,
    openingDcType: "Dr",
    totalDebit,
    totalCredit,
    closingBalance: Math.abs(closingBalance),
    closingDcType: closingBalance >= 0 ? "Dr" : "Cr",
    country: "",
    branch: "",
    currency,
    rows
  };
}
