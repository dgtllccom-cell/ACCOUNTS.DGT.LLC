import fs from 'fs';
import postgres from 'postgres';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5, prepare: false });

const CRM_SAMPLE_ITEMS = [
  // 1. Meezan Bank (Cheque Deposit)
  {
    sourceType: "cheque_deposit",
    sourceId: "CHQ-DEP-000458",
    referenceNo: "RCPT-000458",
    partyName: "Meezan Bank",
    dueDate: "2025-05-21",
    itemType: "Cheque Deposit",
    module: "Receipt",
    amount: 850000,
    paidAmount: 0,
    remainingAmount: 850000,
    currency: "PKR",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0012",
    responsibleUserName: "Ali Raza",
    urgencyClass: "due_today",
    status: "Due Today"
  },
  // 2. Al-Fatah Trading (Cheque Pay)
  {
    sourceType: "cheque_pay",
    sourceId: "CHQ-PAY-000985",
    referenceNo: "PAY-000985",
    partyName: "Al-Fatah Trading",
    dueDate: "2025-05-21",
    itemType: "Cheque Pay",
    module: "Payment",
    amount: 620000,
    paidAmount: 0,
    remainingAmount: 620000,
    currency: "PKR",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0014",
    responsibleUserName: "Imran Khan",
    urgencyClass: "due_today",
    status: "Due Today"
  },
  // 3. Usman & Sons (Collect From Customer)
  {
    sourceType: "sales_recovery",
    sourceId: "SO-REC-001245",
    referenceNo: "INV-001245",
    partyName: "Usman & Sons",
    dueDate: "2025-05-21",
    itemType: "Collect From Customer",
    module: "Sales Invoice",
    amount: 12500,
    paidAmount: 0,
    remainingAmount: 12500,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0018",
    responsibleUserName: "Sana Khan",
    urgencyClass: "due_today",
    status: "Due Today"
  },
  // 4. China Steel Ltd. (Purchase Payment)
  {
    sourceType: "purchase_payment",
    sourceId: "PUR-DUE-000789",
    referenceNo: "PUR-000789",
    partyName: "China Steel Ltd.",
    dueDate: "2025-05-21",
    itemType: "Purchase Payment",
    module: "Purchase",
    amount: 18600,
    paidAmount: 5000,
    remainingAmount: 13600,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0021",
    responsibleUserName: "Bilal Ahmed",
    urgencyClass: "due_today",
    status: "Due Today"
  },
  // 5. Maersk Line (Shipping Payment)
  {
    sourceType: "shipping_payment",
    sourceId: "BL-PMT-000345",
    referenceNo: "BL-000345",
    partyName: "Maersk Line",
    dueDate: "2025-05-21",
    itemType: "Shipping Payment",
    module: "BL Payment",
    amount: 3800,
    paidAmount: 1800,
    remainingAmount: 2000,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0025",
    responsibleUserName: "Asad Ali",
    urgencyClass: "due_today",
    status: "Due Today"
  },
  // 6. Zain Traders (Overdue Follow-Up)
  {
    sourceType: "sales_recovery_ovd",
    sourceId: "INV-OVD-001055",
    referenceNo: "INV-001055",
    partyName: "Zain Traders",
    dueDate: "2025-05-16",
    itemType: "Sales Recovery",
    module: "Sales Invoice",
    amount: 8450,
    paidAmount: 0,
    remainingAmount: 8450,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0018",
    responsibleUserName: "Sana Khan",
    urgencyClass: "overdue",
    status: "Overdue"
  },
  // 7. Hassan Corporation (Overdue Purchase)
  {
    sourceType: "purchase_ovd",
    sourceId: "PUR-OVD-000654",
    referenceNo: "PUR-000654",
    partyName: "Hassan Corporation",
    dueDate: "2025-05-14",
    itemType: "Purchase Payment",
    module: "Purchase",
    amount: 6200,
    paidAmount: 0,
    remainingAmount: 6200,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0021",
    responsibleUserName: "Bilal Ahmed",
    urgencyClass: "overdue",
    status: "Overdue"
  },
  // 8. Gul Shipping (Overdue BL Payment)
  {
    sourceType: "shipping_ovd",
    sourceId: "BL-OVD-000223",
    referenceNo: "BL-000223",
    partyName: "Gul Shipping",
    dueDate: "2025-05-18",
    itemType: "Shipping Payment",
    module: "BL Payment",
    amount: 1750,
    paidAmount: 0,
    remainingAmount: 1750,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0025",
    responsibleUserName: "Asad Ali",
    urgencyClass: "overdue",
    status: "Overdue"
  },
  // 9. Upcoming: Meezan Bank (Cheque Deposit)
  {
    sourceType: "cheque_upc_1",
    sourceId: "CHQ-UPC-000221",
    referenceNo: "RCPT-000512",
    partyName: "Meezan Bank",
    dueDate: "2025-05-22",
    itemType: "Cheque Deposit",
    module: "Receipt",
    amount: 1250000,
    paidAmount: 0,
    remainingAmount: 1250000,
    currency: "PKR",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0012",
    responsibleUserName: "Ali Raza",
    urgencyClass: "due_tomorrow",
    status: "Due Tomorrow"
  },
  // 10. Upcoming: Al-Najeeb Traders (Purchase Payment)
  {
    sourceType: "purchase_upc_1",
    sourceId: "PUR-UPC-000991",
    referenceNo: "PUR-000991",
    partyName: "Al-Najeeb Traders",
    dueDate: "2025-05-23",
    itemType: "Purchase Payment",
    module: "Purchase",
    amount: 9800,
    paidAmount: 0,
    remainingAmount: 9800,
    currency: "USD",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0021",
    responsibleUserName: "Bilal Ahmed",
    urgencyClass: "upcoming",
    status: "Upcoming"
  },
  // 11. Upcoming: Habib Bank (Cheque Collection)
  {
    sourceType: "cheque_upc_2",
    sourceId: "CHQ-UPC-000344",
    referenceNo: "RCPT-000540",
    partyName: "Habib Bank",
    dueDate: "2025-05-24",
    itemType: "Collect From Customer",
    module: "Receipt",
    amount: 2100000,
    paidAmount: 0,
    remainingAmount: 2100000,
    currency: "PKR",
    countryId: "pk",
    countryName: "Pakistan",
    countryBranchId: "pk_khi",
    cityBranchId: "pk_khi_city",
    branchName: "Karachi City",
    responsibleUserId: "USR-0012",
    responsibleUserName: "Ali Raza",
    urgencyClass: "upcoming",
    status: "Upcoming"
  }
];

async function seedCrmData() {
  console.log("=== SEEDING SMART CRM ACTION ITEMS ===");

  for (const item of CRM_SAMPLE_ITEMS) {
    await sql`
      INSERT INTO crm_action_items (
        source_type,
        source_id,
        reference_no,
        party_name,
        due_date,
        item_type,
        module,
        amount,
        paid_amount,
        remaining_amount,
        currency,
        country_id,
        country_name,
        country_branch_id,
        city_branch_id,
        branch_name,
        responsible_user_id,
        responsible_user_name,
        urgency_class,
        status,
        global_serial,
        country_serial,
        branch_serial,
        entry_serial
      ) VALUES (
        ${item.sourceType},
        ${item.sourceId},
        ${item.referenceNo},
        ${item.partyName},
        ${item.dueDate}::date,
        ${item.itemType},
        ${item.module},
        ${item.amount},
        ${item.paidAmount},
        ${item.remainingAmount},
        ${item.currency},
        ${item.countryId},
        ${item.countryName},
        ${item.countryBranchId},
        ${item.cityBranchId},
        ${item.branchName},
        ${item.responsibleUserId},
        ${item.responsibleUserName},
        ${item.urgencyClass},
        ${item.status},
        '2025-05-21-0001',
        'PK-2025-05-21-0001',
        'KHI-2025-05-21-0001',
        '00012345'
      )
      ON CONFLICT (source_type, source_id) DO UPDATE SET
        party_name = EXCLUDED.party_name,
        due_date = EXCLUDED.due_date,
        amount = EXCLUDED.amount,
        remaining_amount = EXCLUDED.remaining_amount,
        urgency_class = EXCLUDED.urgency_class,
        status = EXCLUDED.status,
        updated_at = NOW();
    `;
  }

  console.log(`✅ Successfully seeded ${CRM_SAMPLE_ITEMS.length} Smart CRM items!`);
  await sql.end();
}

seedCrmData().catch(e => {
  console.error("Seed error:", e);
  process.exit(1);
});
