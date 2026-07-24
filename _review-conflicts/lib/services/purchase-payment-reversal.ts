export async function revertOrderBookingTransfer(orderId: string, supabase: any, adminSupabase: any) {
  // Find ALL existing purchase order payments of kind 'booking' or 'credit' (the transfer records)
  const { data: existingPayments } = await supabase
    .from("purchase_order_payments")
    .select("id, roznamcha_entry_id, entry_date")
    .eq("purchase_order_id", orderId)
    .in("kind", ["booking", "credit"])
    .eq("status", "posted");

  if (!existingPayments || existingPayments.length === 0) {
    return;
  }

  for (const existingPayment of existingPayments) {
    if (!existingPayment.roznamcha_entry_id) continue;

    // Retrieve roznamcha lines to revert the ledger totals
    const { data: lines } = await supabase
      .from("roznamcha_lines")
      .select("ledger_id, enterprise_account_id, debit, credit")
      .eq("roznamcha_entry_id", existingPayment.roznamcha_entry_id);

    if (lines && lines.length > 0) {
      for (const line of lines) {
        // Revert ledgers totals
        const { data: ledger } = await adminSupabase
          .from("ledgers")
          .select("debit_total, credit_total, current_balance")
          .eq("id", line.ledger_id)
          .maybeSingle();
        if (ledger) {
          await adminSupabase
            .from("ledgers")
            .update({
              debit_total: Number(ledger.debit_total || 0) - Number(line.debit || 0),
              credit_total: Number(ledger.credit_total || 0) - Number(line.credit || 0),
              current_balance: Number(ledger.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
              updated_at: new Date().toISOString()
            })
            .eq("id", line.ledger_id);
        }

        // Revert enterprise_accounts totals
        if (line.enterprise_account_id) {
          const { data: entAcc } = await adminSupabase
            .from("enterprise_accounts")
            .select("current_balance")
            .eq("id", line.enterprise_account_id)
            .maybeSingle();
          if (entAcc) {
            await adminSupabase
              .from("enterprise_accounts")
              .update({
                current_balance: Number(entAcc.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                updated_at: new Date().toISOString()
              })
              .eq("id", line.enterprise_account_id);
          }
        }

        // Revert ledger_balances records
        const { data: balRecord } = await adminSupabase
          .from("ledger_balances")
          .select("debit_total, credit_total, closing_balance")
          .eq("ledger_id", line.ledger_id)
          .eq("balance_date", existingPayment.entry_date)
          .maybeSingle();
        if (balRecord) {
          await adminSupabase
            .from("ledger_balances")
            .update({
              debit_total: Number(balRecord.debit_total || 0) - Number(line.debit || 0),
              credit_total: Number(balRecord.credit_total || 0) - Number(line.credit || 0),
              closing_balance: Number(balRecord.closing_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
              updated_at: new Date().toISOString()
            })
            .eq("ledger_id", line.ledger_id)
            .eq("balance_date", existingPayment.entry_date);
        }
      }
    }

    // Delete the existing payment row
    await adminSupabase
      .from("purchase_order_payments")
      .delete()
      .eq("id", existingPayment.id);

    // Delete the roznamcha_entries row (cascades to roznamcha_lines)
    await adminSupabase
      .from("roznamcha_entries")
      .delete()
      .eq("id", existingPayment.roznamcha_entry_id);
  }
}

export async function revertAllOrderPayments(orderId: string, supabase: any, adminSupabase: any) {
  // Find ALL posted payments for this order
  const { data: payments } = await supabase
    .from("purchase_order_payments")
    .select("id, roznamcha_entry_id, entry_date")
    .eq("purchase_order_id", orderId)
    .eq("status", "posted")
    .not("roznamcha_entry_id", "is", null);

  if (!payments || payments.length === 0) {
    return;
  }

  for (const payment of payments) {
    // Retrieve roznamcha lines to revert the ledger totals
    const { data: lines } = await supabase
      .from("roznamcha_lines")
      .select("ledger_id, enterprise_account_id, debit, credit")
      .eq("roznamcha_entry_id", payment.roznamcha_entry_id);

    if (lines && lines.length > 0) {
      for (const line of lines) {
        // Revert ledgers totals
        const { data: ledger } = await adminSupabase
          .from("ledgers")
          .select("debit_total, credit_total, current_balance")
          .eq("id", line.ledger_id)
          .maybeSingle();
        if (ledger) {
          await adminSupabase
            .from("ledgers")
            .update({
              debit_total: Number(ledger.debit_total || 0) - Number(line.debit || 0),
              credit_total: Number(ledger.credit_total || 0) - Number(line.credit || 0),
              current_balance: Number(ledger.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
              updated_at: new Date().toISOString()
            })
            .eq("id", line.ledger_id);
        }

        // Revert enterprise_accounts totals
        if (line.enterprise_account_id) {
          const { data: entAcc } = await adminSupabase
            .from("enterprise_accounts")
            .select("current_balance")
            .eq("id", line.enterprise_account_id)
            .maybeSingle();
          if (entAcc) {
            await adminSupabase
              .from("enterprise_accounts")
              .update({
                current_balance: Number(entAcc.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                updated_at: new Date().toISOString()
              })
              .eq("id", line.enterprise_account_id);
          }
        }

        // Revert ledger_balances records
        const { data: balRecord } = await adminSupabase
          .from("ledger_balances")
          .select("debit_total, credit_total, closing_balance")
          .eq("ledger_id", line.ledger_id)
          .eq("balance_date", payment.entry_date)
          .maybeSingle();
        if (balRecord) {
          await adminSupabase
            .from("ledger_balances")
            .update({
              debit_total: Number(balRecord.debit_total || 0) - Number(line.debit || 0),
              credit_total: Number(balRecord.credit_total || 0) - Number(line.credit || 0),
              closing_balance: Number(balRecord.closing_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
              updated_at: new Date().toISOString()
            })
            .eq("ledger_id", line.ledger_id)
            .eq("balance_date", payment.entry_date);
        }
      }
    }

    // Delete the existing payment row
    await adminSupabase
      .from("purchase_order_payments")
      .delete()
      .eq("id", payment.id);

    // Delete the roznamcha_entries row (cascades to roznamcha_lines)
    await adminSupabase
      .from("roznamcha_entries")
      .delete()
      .eq("id", payment.roznamcha_entry_id);
  }
}
