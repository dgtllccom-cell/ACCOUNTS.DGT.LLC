import fs from "node:fs";
import postgres from "postgres";

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) {
    args.set(token.slice(2), "true");
  } else {
    args.set(token.slice(2), next);
    i += 1;
  }
}

function required(name) {
  const value = args.get(name);
  if (!value) throw new Error(`Missing required argument --${name}`);
  return value;
}

function money(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) throw new Error(`Invalid money value: ${value}`);
  return Math.round(numeric * 10000) / 10000;
}

function assertDistinctLedgers(debitLedgerId, creditLedgerId) {
  if (!debitLedgerId || !creditLedgerId) throw new Error("Both debit and credit ledger IDs are required.");
  if (debitLedgerId === creditLedgerId) throw new Error("Debit and credit ledger IDs must be different.");
}

function assertLedgerScopeMatches(order, ledger, label) {
  if (!ledger) throw new Error(`${label} ledger was not found.`);
  if (order.country_id && ledger.country_id && ledger.country_id !== order.country_id) {
    throw new Error(`${label} ledger belongs to a different country.`);
  }
  if (order.country_branch_id && ledger.country_branch_id && ledger.country_branch_id !== order.country_branch_id) {
    throw new Error(`${label} ledger belongs to a different main branch.`);
  }
  if (order.city_branch_id && ledger.city_branch_id && ledger.city_branch_id !== order.city_branch_id) {
    throw new Error(`${label} ledger belongs to a different city branch.`);
  }
}

function assertTwoBalancedLines(lines, debitLedgerId, creditLedgerId, expectedAmount) {
  if (!Array.isArray(lines) || lines.length !== 2) {
    throw new Error("Expected exactly two Roznamcha lines for the repaired booking.");
  }

  const debitLine = lines.find((line) => line.ledger_id === debitLedgerId && money(line.debit) > 0 && money(line.credit) === 0);
  const creditLine = lines.find((line) => line.ledger_id === creditLedgerId && money(line.credit) > 0 && money(line.debit) === 0);
  if (!debitLine || !creditLine) {
    throw new Error("Repaired lines do not contain the selected distinct debit and credit ledgers.");
  }

  const debitTotal = lines.reduce((sum, line) => sum + money(line.debit), 0);
  const creditTotal = lines.reduce((sum, line) => sum + money(line.credit), 0);
  if (debitTotal !== creditTotal || debitTotal !== money(expectedAmount)) {
    throw new Error("Repaired Roznamcha lines are not balanced to the expected amount.");
  }
}

function normalizeScope(order) {
  if (order.city_branch_id) {
    return { scopeType: "city_branch", scopeKey: order.city_branch_id, rozType: "branch" };
  }
  if (order.country_branch_id) {
    return { scopeType: "main_branch", scopeKey: order.country_branch_id, rozType: "branch" };
  }
  if (order.country_id) {
    return { scopeType: "country", scopeKey: order.country_id, rozType: "country" };
  }
  return { scopeType: "global", scopeKey: "global", rozType: "super_admin" };
}

async function main() {
  const commit = args.get("commit") === "true";
  const dryRun = args.get("dry-run") === "true" || !commit;
  const purchaseOrderId = required("purchase-order-id");
  const purchaseOrderNo = required("purchase-order-no");
  const paymentId = required("payment-id");
  const debitLedgerId = required("debit-ledger-id");
  const creditLedgerId = required("credit-ledger-id");
  const expectedAmount = money(required("expected-amount"));
  const entryDate = args.get("entry-date") || new Date().toISOString().slice(0, 10);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 20,
    idle_timeout: 5
  });

  try {
    const result = await sql.begin(async (tx) => {
      const [order] = await tx`
        select id, purchase_order_no, country_id, country_branch_id, city_branch_id, currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, payment_status, ledger_posting_status, form_data
        from purchase_orders
        where id = ${purchaseOrderId}
          and purchase_order_no = ${purchaseOrderNo}
          and deleted_at is null
        for update;
      `;
      if (!order) throw new Error("Target purchase order was not found.");

      const paymentRows = await tx`
        select id, purchase_order_id, kind, entry_date, amount, currency_code, exchange_rate, debit_ledger_id, credit_ledger_id, roznamcha_entry_id, status, reference_no, narration, source_module, source_transaction_type, source_reference_no, original_currency_code, currency_name, base_currency_amount, posted_to_journal, journal_posted_at, created_at, updated_at
        from purchase_order_payments
        where id = ${paymentId}
          and purchase_order_id = ${order.id}
          and kind = 'booking'
          and deleted_at is null
        for update;
      `;
      if (paymentRows.length !== 1) {
        throw new Error(`Expected exactly one booking payment for ${purchaseOrderNo}, found ${paymentRows.length}.`);
      }

      const payment = paymentRows[0];
      if (!payment.roznamcha_entry_id) {
        throw new Error("Target booking payment is missing its linked Roznamcha entry.");
      }

      if (money(payment.amount) !== expectedAmount) {
        throw new Error(`Payment amount ${payment.amount} does not match expected amount ${expectedAmount}.`);
      }

      assertDistinctLedgers(debitLedgerId, creditLedgerId);

      const [debitLedger] = await tx`
        select id, country_id, country_branch_id, city_branch_id, enterprise_account_id
        from ledgers
        where id = ${debitLedgerId}
          and deleted_at is null
          and is_active = true
        for update;
      `;
      const [creditLedger] = await tx`
        select id, country_id, country_branch_id, city_branch_id, enterprise_account_id
        from ledgers
        where id = ${creditLedgerId}
          and deleted_at is null
          and is_active = true
        for update;
      `;

      assertLedgerScopeMatches(order, debitLedger, "Debit");
      assertLedgerScopeMatches(order, creditLedger, "Credit");

      const [entry] = await tx`
        select id, type, country_id, country_branch_id, city_branch_id, journal_no, voucher_no, entry_date, reference_no, narration, status, posted_at, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number, source_module, source_transaction_type, source_transaction_id, source_reference_no, original_currency_code, currency_name, base_currency_amount, updated_at
        from roznamcha_entries
        where id = ${payment.roznamcha_entry_id}
          and deleted_at is null
        for update;
      `;
      if (!entry) {
        throw new Error("Linked Roznamcha entry was not found.");
      }

      const existingLines = await tx`
        select id, ledger_id, debit, credit, payment_entry_type, currency, usd_rate, usd_amount, enterprise_account_id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number
        from roznamcha_lines
        where roznamcha_entry_id = ${entry.id}
        order by created_at nulls last, id
        for update;
      `;

      if (existingLines.length > 0) {
        assertTwoBalancedLines(existingLines, debitLedgerId, creditLedgerId, expectedAmount);
      }

      const scope = normalizeScope(order);
      const countryPrefixRow = order.country_id
        ? await tx`select coalesce(nullif(iso2, ''), coalesce(nullif(iso3, ''), name)) as prefix from countries where id = ${order.country_id} limit 1`
        : [];
      const mainBranchPrefixRow = order.country_branch_id
        ? await tx`select coalesce(nullif(code, ''), name) as prefix from country_branches where id = ${order.country_branch_id} limit 1`
        : [];
      const cityBranchPrefixRow = order.city_branch_id
        ? await tx`select coalesce(nullif(code, ''), name) as prefix from city_branches where id = ${order.city_branch_id} limit 1`
        : [];

      const superAdminSerial = entry.super_admin_serial_number || await tx`
        select next_transaction_serial('global', 'global', 'SA') as serial
      `.then((rows) => rows[0].serial);
      const countrySerial = entry.country_transaction_serial_number || (order.country_id
        ? await tx`select next_transaction_serial('country', ${order.country_id}::text, ${String(countryPrefixRow[0]?.prefix || "CNT")}) as serial`
          .then((rows) => rows[0].serial)
        : null);
      const branchSerial = entry.branch_transaction_serial_number || ((order.city_branch_id || order.country_branch_id)
        ? await tx`select next_transaction_serial('branch', ${String(order.city_branch_id || order.country_branch_id)}::text, ${String((order.city_branch_id ? cityBranchPrefixRow[0]?.prefix : mainBranchPrefixRow[0]?.prefix) || "BR")}) as serial`
          .then((rows) => rows[0].serial)
        : null);
      const mainBranchSerial = entry.main_branch_transaction_serial || (order.country_branch_id
        ? await tx`select next_transaction_serial('main_branch', ${order.country_branch_id}::text, ${String(mainBranchPrefixRow[0]?.prefix || "MB")}) as serial`
          .then((rows) => rows[0].serial)
        : null);
      const cityBranchSerial = entry.city_branch_transaction_serial || (order.city_branch_id
        ? await tx`select next_transaction_serial('city_branch', ${order.city_branch_id}::text, ${String(cityBranchPrefixRow[0]?.prefix || "CB")}) as serial`
          .then((rows) => rows[0].serial)
        : null);
      const entrySerial = entry.entry_serial_number || await tx`
        select next_transaction_serial('module_roznamcha', 'global', 'ROZ') as serial
      `.then((rows) => rows[0].serial);

      if (!dryRun) {
        await tx`
          update purchase_order_payments
          set debit_ledger_id = ${debitLedgerId},
              credit_ledger_id = ${creditLedgerId},
              status = 'posted',
              updated_at = now(),
              source_module = 'purchase',
              source_transaction_type = 'purchase_booking_transfer',
              source_reference_no = coalesce(reference_no, ${purchaseOrderNo}),
              original_currency_code = coalesce(original_currency_code, currency_code),
              currency_name = coalesce(currency_name, currency_code),
              base_currency_amount = coalesce(base_currency_amount, amount * exchange_rate),
              posted_to_journal = true,
              journal_posted_at = coalesce(journal_posted_at, now())
          where id = ${payment.id};
        `;

        await tx`delete from roznamcha_lines where roznamcha_entry_id = ${entry.id};`;

        await tx`
          insert into roznamcha_lines (
            roznamcha_entry_id,
            payment_entry_type,
            ledger_id,
            account_id,
            enterprise_account_id,
            description,
            debit,
            credit,
            currency,
            usd_rate,
            usd_amount,
            super_admin_serial_number,
            country_transaction_serial_number,
            branch_transaction_serial_number,
            main_branch_transaction_serial,
            city_branch_transaction_serial,
            entry_serial_number
          )
          values (
            ${entry.id},
            'debit',
            ${debitLedgerId},
            null,
            ${debitLedger.enterprise_account_id},
            ${`Purchase booking repair for ${purchaseOrderNo}`},
            ${expectedAmount},
            0,
            ${order.currency_code || payment.currency_code || "USD"},
            1,
            ${expectedAmount},
            ${superAdminSerial},
            ${countrySerial},
            ${branchSerial},
            ${mainBranchSerial},
            ${cityBranchSerial},
            ${entrySerial}
          ),
          (
            ${entry.id},
            'credit',
            ${creditLedgerId},
            null,
            ${creditLedger.enterprise_account_id},
            ${`Purchase booking repair for ${purchaseOrderNo}`},
            0,
            ${expectedAmount},
            ${order.currency_code || payment.currency_code || "USD"},
            1,
            ${expectedAmount},
            ${superAdminSerial},
            ${countrySerial},
            ${branchSerial},
            ${mainBranchSerial},
            ${cityBranchSerial},
            ${entrySerial}
          );
        `;

        const [verifiedLines] = await tx`
          select count(*)::int as line_count,
                 coalesce(sum(debit), 0)::numeric as debit_total,
                 coalesce(sum(credit), 0)::numeric as credit_total
          from roznamcha_lines
          where roznamcha_entry_id = ${entry.id}
        `;
        if (verifiedLines.line_count !== 2 || money(verifiedLines.debit_total) !== money(verifiedLines.credit_total) || money(verifiedLines.debit_total) !== expectedAmount) {
          throw new Error("Repair verification failed after writing Roznamcha lines.");
        }

        await tx`
          update roznamcha_entries
          set type = ${scope.rozType},
              country_id = ${order.country_id},
              country_branch_id = ${order.country_branch_id},
              city_branch_id = ${order.city_branch_id},
              journal_no = coalesce(nullif(journal_no, ''), ${`JO-PURCHASE-${purchaseOrderNo}`}),
              voucher_no = coalesce(nullif(voucher_no, ''), ${`VO-PURCHASE-${purchaseOrderNo}`}),
              entry_date = ${entryDate},
              reference_no = coalesce(reference_no, ${purchaseOrderNo}),
              narration = coalesce(narration, ${`Purchase booking repair for ${purchaseOrderNo}`}),
              status = 'posted',
              posted_at = now(),
              super_admin_serial_number = ${superAdminSerial},
              country_transaction_serial_number = ${countrySerial},
              branch_transaction_serial_number = ${branchSerial},
              main_branch_transaction_serial = ${mainBranchSerial},
              city_branch_transaction_serial = ${cityBranchSerial},
              entry_serial_number = ${entrySerial},
              source_module = 'purchase',
              source_transaction_type = 'purchase_booking_transfer',
              source_transaction_id = ${order.id},
              source_reference_no = coalesce(source_reference_no, ${purchaseOrderNo}),
              original_currency_code = coalesce(original_currency_code, ${order.currency_code || payment.currency_code || "USD"}),
              currency_name = coalesce(currency_name, ${order.currency_code || payment.currency_code || "USD"}),
              base_currency_amount = coalesce(base_currency_amount, ${expectedAmount}),
              updated_at = now()
          where id = ${entry.id};
        `;

        const existingAdvance = money(order.advance_paid || 0);
        const newRemainingDue = Math.max(0, money(order.order_total || expectedAmount) - existingAdvance);
        const newPaymentStatus = newRemainingDue <= 0 ? "completed" : existingAdvance > 0 ? "partial" : "pending";
        const now = new Date().toISOString();
        await tx`
          update purchase_orders
          set ledger_posting_status = 'posted',
              payment_status = ${newPaymentStatus},
              is_edited_since_transfer = false,
              remaining_due = ${newRemainingDue},
              updated_at = ${now},
              form_data = jsonb_set(
                coalesce(form_data, '{}'::jsonb),
                '{workflow}',
                coalesce(form_data->'workflow', '{}'::jsonb)
                  || jsonb_build_object(
                    'transferStatus', 'transferred',
                    'journalStatus', 'posted',
                    'ledgerStatus', 'posted',
                    'currentStep', ${scope.rozType === "branch" ? "purchase_advance_payment" : "purchase_remaining_payment"},
                    'systemBillNumber', ${purchaseOrderNo},
                    'manualBillNumber', ${String(order.purchase_contract_no || "")},
                    'referenceNo', ${purchaseOrderNo},
                    'sourceModule', 'purchase',
                    'sourceTransactionType', 'purchase_transfer_to_payment',
                    'transferredAt', ${now}
                  ),
                true
              )
          where id = ${order.id};
        `;

        await tx`
          insert into audit_logs (actor_id, action, entity_table, entity_id, after, created_at)
          values (
            null,
            'repair_purchase_booking_transfer',
            'purchase_orders',
            ${order.id},
            jsonb_build_object(
              'purchaseOrderId', ${order.id},
              'purchaseOrderNo', ${purchaseOrderNo},
              'paymentId', ${payment.id},
              'roznamchaEntryId', ${entry.id},
              'debitLedgerId', ${debitLedgerId},
              'creditLedgerId', ${creditLedgerId},
              'amount', ${expectedAmount},
              'entryDate', ${entryDate}
            ),
            now()
          );
        `;
      }

      return {
        dryRun,
        purchaseOrderId: order.id,
        purchaseOrderNo: order.purchase_order_no,
        paymentId: payment.id,
        roznamchaEntryId: payment.roznamcha_entry_id,
        expectedAmount,
        entryDate
      };
    });

    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

