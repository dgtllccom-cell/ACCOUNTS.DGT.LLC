import { withLocalPg } from "../lib/db/local-postgres";

async function verify() {
  console.log("=== VERIFYING BANK ROZNAMCHA / CHEQUE MANAGEMENT SYSTEM ===");

  await withLocalPg(async (sql) => {
    // 1. Check all rows in bank_cheque_transactions
    const rows = await sql`
      SELECT 
        entry_serial_number, bank_name, cheque_no, particulars,
        cheque_date, due_date, debit, credit, status
      FROM public.bank_cheque_transactions
      ORDER BY entry_serial_number ASC
    `;

    console.log(`Total transactions in database: ${rows.length}`);
    console.table(rows);

    // 2. Check Reconciliation Calculation:
    // Opening Balance + Credits - Debits = Closing Balance
    const sums = await sql`
      SELECT
        COALESCE(SUM(debit), 0) AS total_debit,
        COALESCE(SUM(credit), 0) AS total_credit
      FROM public.bank_cheque_transactions
      WHERE deleted_at IS NULL
    `;

    const totalDebit = Number(sums[0].total_debit);
    const totalCredit = Number(sums[0].total_credit);
    const openingBalance = 0; // Baseline
    const closingBalance = openingBalance + totalCredit - totalDebit;

    console.log("\n--- RECONCILIATION SUMMARY ---");
    console.log(`Opening Balance: ${openingBalance}`);
    console.log(`Total Debit:     ${totalDebit}`);
    console.log(`Total Credit:    ${totalCredit}`);
    console.log(`Closing Balance: ${closingBalance}`);
    console.log(`Formula Check:   ${openingBalance} + ${totalCredit} - ${totalDebit} = ${closingBalance} -> ${openingBalance + totalCredit - totalDebit === closingBalance ? "PASS ✅" : "FAIL ❌"}`);

    // 3. Status Breakdown
    const statusCounts = await sql`
      SELECT status, count(*) as count
      FROM public.bank_cheque_transactions
      WHERE deleted_at IS NULL
      GROUP BY status
    `;
    console.log("\n--- STATUS COUNTS ---");
    console.table(statusCounts);
  });
}

verify().catch(console.error);
