import fs from 'fs';
import postgres from 'postgres';
import crypto from 'crypto';

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

const SAMPLE_ENTITIES = [
  // 1. PO-2826-6874 (Exact Match with Mockup 1 & 2)
  {
    entityType: "purchases",
    entityId: "PO-2826-6874",
    referenceNo: "PO-2826-6874",
    module: "Purchase",
    countryId: "pk",
    countryName: "Pakistan",
    cityBranchId: "pk_main",
    branchName: "Pakistan Main Branch",
    partyName: "Al Noor Traders",
    amount: 450000,
    currency: "PKR",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Super Admin",
        userId: "USR-0001",
        userRole: "Super Admin",
        createdAt: "2026-08-19T20:41:12Z",
        reason: "Initial purchase bill created",
        diffChanges: [],
        snapshot: {
          bill_no: "PO-2826-6874",
          party: "Al Noor Traders",
          purchase_amount: 380000,
          currency: "PKR",
          exchange_rate: "1.0000",
          quantity: "850.00",
          debit_account: "1200 - Inventory - General",
          credit_account: "2101 - Accounts Payable - Local",
          narration: "Initial purchase order"
        }
      },
      {
        versionNumber: 2,
        actionType: "EDIT",
        userName: "Ali Hassan",
        userId: "USR-0024",
        userRole: "Manager",
        createdAt: "2026-08-22T09:14:33Z",
        reason: "Updated purchase amount and quantity as per supplier invoice",
        diffChanges: [
          { field: "purchase_amount", label: "Purchase Amount", oldValue: "380,000.00", newValue: "450,000.00", isHighRisk: true },
          { field: "quantity", label: "Quantity", oldValue: "850.00", newValue: "1,000.00", isHighRisk: false },
          { field: "narration", label: "Narration", oldValue: "Initial purchase order", newValue: "Purchase of raw materials as per PO-2826", isHighRisk: false }
        ],
        snapshot: {
          bill_no: "PO-2826-6874",
          party: "Al Noor Traders",
          purchase_amount: 450000,
          currency: "PKR",
          exchange_rate: "1.0000",
          quantity: "1,000.00",
          debit_account: "1200 - Inventory - General",
          credit_account: "2101 - Accounts Payable - Local",
          narration: "Purchase of raw materials as per PO-2826"
        }
      },
      {
        versionNumber: 3,
        actionType: "EDIT",
        userName: "Neha Sharma",
        userId: "USR-0056",
        userRole: "Accountant",
        createdAt: "2026-08-24T16:28:07Z",
        reason: "Corrected debit account to Raw Materials ledger",
        diffChanges: [
          { field: "debit_account", label: "Debit Account", oldValue: "1200 - Inventory - General", newValue: "1205 - Purchases - Raw Materials", isHighRisk: true }
        ],
        snapshot: {
          bill_no: "PO-2826-6874",
          party: "Al Noor Traders",
          purchase_amount: 450000,
          currency: "PKR",
          exchange_rate: "1.0000",
          quantity: "1,000.00",
          debit_account: "1205 - Purchases - Raw Materials",
          credit_account: "2101 - Accounts Payable - Local",
          narration: "Purchase of raw materials as per PO-2826"
        }
      },
      {
        versionNumber: 4,
        actionType: "SOFT_DELETE",
        userName: "Super Admin",
        userId: "USR-0001",
        userRole: "Super Admin",
        createdAt: "2026-08-26T20:33:22Z",
        deletedAt: "2026-08-26T20:33:22Z",
        reason: "Duplicate Entry",
        isDeleted: true,
        riskLevel: "High",
        reviewStatus: "Pending",
        reviewerComments: "Marked as duplicate. Original bill PO-2826-5541 exists.",
        approvalReference: "APP-8286-3344",
        diffChanges: [],
        snapshot: {
          bill_no: "PO-2826-6874",
          party: "Al Noor Traders",
          purchase_amount: 450000,
          currency: "PKR",
          exchange_rate: "1.0000",
          quantity: "1,000.00",
          debit_account: "1205 - Purchases - Raw Materials",
          credit_account: "2101 - Accounts Payable - Local",
          narration: "Purchase of raw materials as per PO-2826"
        }
      }
    ]
  },

  // 2. SO-2826-5541 (Sales Entry)
  {
    entityType: "sales",
    entityId: "SO-2826-5541",
    referenceNo: "SO-2826-5541",
    module: "Sales",
    countryId: "ae",
    countryName: "UAE",
    cityBranchId: "dxb_main",
    branchName: "Dubai Main Branch",
    partyName: "Gulf Retail LLC",
    amount: 125000,
    currency: "AED",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Ali Hassan",
        userId: "USR-0024",
        userRole: "Manager",
        createdAt: "2026-08-26T20:18:44Z",
        reason: "Sales booking order created",
        diffChanges: [],
        snapshot: { party: "Gulf Retail LLC", amount: 125000, currency: "AED" }
      },
      {
        versionNumber: 2,
        actionType: "SOFT_DELETE",
        userName: "Ali Hassan",
        userId: "USR-0024",
        userRole: "Manager",
        createdAt: "2026-08-26T20:19:33Z",
        deletedAt: "2026-08-26T20:19:33Z",
        reason: "Customer Request",
        isDeleted: true,
        riskLevel: "Medium",
        reviewStatus: "Reviewed",
        reviewerComments: "Customer requested cancellation before shipment.",
        approvalReference: "APP-9102-4421",
        diffChanges: [],
        snapshot: { party: "Gulf Retail LLC", amount: 125000, currency: "AED" }
      }
    ]
  },

  // 3. CE-2826-1120 (Cash Entry)
  {
    entityType: "roznamcha",
    entityId: "CE-2826-1120",
    referenceNo: "CE-2826-1120",
    module: "Cash Entry",
    countryId: "in",
    countryName: "India",
    cityBranchId: "in_mum",
    branchName: "Mumbai Branch",
    partyName: "Petty Cash",
    amount: 15000,
    currency: "INR",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Neha Sharma",
        userId: "USR-0056",
        userRole: "Accountant",
        createdAt: "2026-08-26T20:02:31Z",
        reason: "Petty cash voucher",
        diffChanges: [],
        snapshot: { party: "Petty Cash", amount: 15000, currency: "INR" }
      },
      {
        versionNumber: 2,
        actionType: "SOFT_DELETE",
        userName: "Neha Sharma",
        userId: "USR-0056",
        userRole: "Accountant",
        createdAt: "2026-08-26T20:03:45Z",
        deletedAt: "2026-08-26T20:03:45Z",
        reason: "Incorrect Amount",
        isDeleted: true,
        riskLevel: "Low",
        reviewStatus: "Reviewed",
        reviewerComments: "Voucher re-issued with correct tax invoice.",
        approvalReference: "APP-5512-9901",
        diffChanges: [],
        snapshot: { party: "Petty Cash", amount: 15000, currency: "INR" }
      }
    ]
  },

  // 4. JV-2826-0098 (Ledger Entry)
  {
    entityType: "ledgers",
    entityId: "JV-2826-0098",
    referenceNo: "JV-2826-0098",
    module: "Ledger",
    countryId: "pk",
    countryName: "Pakistan",
    cityBranchId: "pk_qta",
    branchName: "Quetta City Branch",
    partyName: "ABC Industries",
    amount: 890000,
    currency: "PKR",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Bilal Ahmed",
        userId: "USR-0078",
        userRole: "Accountant",
        createdAt: "2026-08-26T19:45:16Z",
        reason: "Journal Voucher entry",
        diffChanges: [],
        snapshot: { party: "ABC Industries", amount: 890000, currency: "PKR" }
      },
      {
        versionNumber: 2,
        actionType: "SOFT_DELETE",
        userName: "Bilal Ahmed",
        userId: "USR-0078",
        userRole: "Accountant",
        createdAt: "2026-08-26T19:47:09Z",
        deletedAt: "2026-08-26T19:47:09Z",
        reason: "Data Correction",
        isDeleted: true,
        riskLevel: "High",
        reviewStatus: "Pending",
        reviewerComments: "Requires Super Admin review for large ledger correction.",
        approvalReference: "APP-7711-2300",
        diffChanges: [],
        snapshot: { party: "ABC Industries", amount: 890000, currency: "PKR" }
      }
    ]
  },

  // 5. LPO-2826-3345 (Local Purchase)
  {
    entityType: "local_purchases",
    entityId: "LPO-2826-3345",
    referenceNo: "LPO-2826-3345",
    module: "Local Purchase",
    countryId: "bd",
    countryName: "Bangladesh",
    cityBranchId: "bd_dhk",
    branchName: "Dhaka Branch",
    partyName: "Shathi Enterprise",
    amount: 320000,
    currency: "BDT",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Fahim Rahman",
        userId: "USR-0091",
        userRole: "Purchaser",
        createdAt: "2026-08-26T19:30:42Z",
        reason: "Local procurement order",
        diffChanges: [],
        snapshot: { party: "Shathi Enterprise", amount: 320000, currency: "BDT" }
      },
      {
        versionNumber: 2,
        actionType: "SOFT_DELETE",
        userName: "Fahim Rahman",
        userId: "USR-0091",
        userRole: "Purchaser",
        createdAt: "2026-08-26T19:31:55Z",
        deletedAt: "2026-08-26T19:31:55Z",
        reason: "Duplicate Entry",
        isDeleted: true,
        riskLevel: "Medium",
        reviewStatus: "Reviewed",
        reviewerComments: "Cancelled duplicate local purchase.",
        approvalReference: "APP-3321-1188",
        diffChanges: [],
        snapshot: { party: "Shathi Enterprise", amount: 320000, currency: "BDT" }
      }
    ]
  },

  // 6. PMT-2826-2210 (Payment Entry)
  {
    entityType: "payments",
    entityId: "PMT-2826-2210",
    referenceNo: "PMT-2826-2210",
    module: "Payment",
    countryId: "pk",
    countryName: "Pakistan",
    cityBranchId: "pk_khi",
    branchName: "Karachi Branch",
    partyName: "Global Logistics",
    amount: 670000,
    currency: "PKR",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Imran Siddiqui",
        userId: "USR-0045",
        userRole: "Accounts Officer",
        createdAt: "2026-08-26T18:18:54Z",
        reason: "Freight payment voucher",
        diffChanges: [],
        snapshot: { party: "Global Logistics", amount: 670000, currency: "PKR" }
      },
      {
        versionNumber: 2,
        actionType: "SOFT_DELETE",
        userName: "Imran Siddiqui",
        userId: "USR-0045",
        userRole: "Accounts Officer",
        createdAt: "2026-08-26T18:20:14Z",
        deletedAt: "2026-08-26T18:20:14Z",
        reason: "Wrong Entry",
        isDeleted: true,
        riskLevel: "High",
        reviewStatus: "Reviewed",
        reviewerComments: "Re-posted to correct clearing agent account.",
        approvalReference: "APP-6644-8822",
        diffChanges: [],
        snapshot: { party: "Global Logistics", amount: 670000, currency: "PKR" }
      }
    ]
  },

  // 7. Active Edit History Record 1: PB-2026-9901 (Purchase Booking with 4 Edits)
  {
    entityType: "purchases",
    entityId: "PB-2026-9901",
    referenceNo: "PB-2026-9901",
    module: "Purchase",
    countryId: "ae",
    countryName: "UAE",
    cityBranchId: "dxb_main",
    branchName: "Dubai Main Branch",
    partyName: "Far East Trading LLC",
    amount: 850000,
    currency: "USD",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Super Admin",
        userId: "USR-0001",
        userRole: "Super Admin",
        createdAt: "2026-08-20T10:00:00Z",
        reason: "Initial booking created",
        diffChanges: [],
        snapshot: { party: "Far East Trading LLC", amount: 750000, currency: "USD" }
      },
      {
        versionNumber: 2,
        actionType: "EDIT",
        userName: "Mohammed Tariq",
        userId: "USR-0033",
        userRole: "Purchaser",
        createdAt: "2026-08-22T14:30:00Z",
        reason: "Quantity adjustment after inspection",
        diffChanges: [
          { field: "quantity", label: "Quantity", oldValue: "10,000", newValue: "12,000", isHighRisk: false },
          { field: "total_amount", label: "Total Amount", oldValue: "750,000", newValue: "820,000", isHighRisk: true }
        ],
        snapshot: { party: "Far East Trading LLC", amount: 820000, currency: "USD" }
      },
      {
        versionNumber: 3,
        actionType: "EDIT",
        userName: "Ali Hassan",
        userId: "USR-0024",
        userRole: "Manager",
        createdAt: "2026-08-24T11:15:00Z",
        reason: "Port destination updated to Jebel Ali",
        diffChanges: [
          { field: "destination_port", label: "Destination Port", oldValue: "Hamriya Port", newValue: "Jebel Ali Port", isHighRisk: false }
        ],
        snapshot: { party: "Far East Trading LLC", amount: 820000, currency: "USD" }
      },
      {
        versionNumber: 4,
        actionType: "EDIT",
        userName: "Super Admin",
        userId: "USR-0001",
        userRole: "Super Admin",
        createdAt: "2026-08-26T17:45:00Z",
        reason: "Final commercial invoice reconciliation",
        diffChanges: [
          { field: "final_amount", label: "Final Amount", oldValue: "820,000", newValue: "850,000", isHighRisk: true }
        ],
        snapshot: { party: "Far East Trading LLC", amount: 850000, currency: "USD" }
      }
    ]
  },

  // 8. Active Edit History Record 2: SHP-2026-7731 (Shipping Booking with 3 Edits)
  {
    entityType: "shipping",
    entityId: "SHP-2026-7731",
    referenceNo: "SHP-2026-7731",
    module: "Shipping",
    countryId: "pk",
    countryName: "Pakistan",
    cityBranchId: "khi_port",
    branchName: "Karachi Port Branch",
    partyName: "Maersk Line Shipping",
    amount: 145000,
    currency: "USD",
    versions: [
      {
        versionNumber: 1,
        actionType: "CREATE",
        userName: "Imran Siddiqui",
        userId: "USR-0045",
        userRole: "Logistics Officer",
        createdAt: "2026-08-21T09:00:00Z",
        reason: "B/L slot booking",
        diffChanges: [],
        snapshot: { party: "Maersk Line Shipping", amount: 120000, currency: "USD" }
      },
      {
        versionNumber: 2,
        actionType: "EDIT",
        userName: "Ali Hassan",
        userId: "USR-0024",
        userRole: "Manager",
        createdAt: "2026-08-23T15:20:00Z",
        reason: "Added 4 container units to consignment",
        diffChanges: [
          { field: "container_count", label: "Containers", oldValue: "10", newValue: "14", isHighRisk: false },
          { field: "freight_amount", label: "Freight Amount", oldValue: "120,000", newValue: "145,000", isHighRisk: true }
        ],
        snapshot: { party: "Maersk Line Shipping", amount: 145000, currency: "USD" }
      },
      {
        versionNumber: 3,
        actionType: "EDIT",
        userName: "Super Admin",
        userId: "USR-0001",
        userRole: "Super Admin",
        createdAt: "2026-08-26T18:00:00Z",
        reason: "Vessel departure ETA confirmed",
        diffChanges: [
          { field: "vessel_eta", label: "Vessel ETA", oldValue: "2026-08-28", newValue: "2026-08-30", isHighRisk: false }
        ],
        snapshot: { party: "Maersk Line Shipping", amount: 145000, currency: "USD" }
      }
    ]
  }
];

async function seedAuditData() {
  console.log("=== SEEDING ENTERPRISE AUDIT & DELETED RECORDS EVIDENCE ===");

  for (const ent of SAMPLE_ENTITIES) {
    for (const v of ent.versions) {
      const isDeleted = v.actionType === "SOFT_DELETE" || v.isDeleted || false;
      await sql`
        INSERT INTO enterprise_audit_events (
          entity_type,
          entity_id,
          reference_no,
          module,
          action_type,
          version_number,
          diff_changes,
          previous_snapshot,
          current_snapshot,
          user_id,
          user_name,
          user_role,
          country_id,
          country_name,
          city_branch_id,
          branch_name,
          ip_address,
          device_session,
          session_id,
          approval_reference,
          edit_access_window,
          approval_status,
          risk_level,
          review_status,
          reviewer_comments,
          party_name,
          amount,
          currency,
          reason,
          is_deleted,
          deleted_at,
          deleted_by,
          created_at
        ) VALUES (
          ${ent.entityType},
          ${ent.entityId},
          ${ent.referenceNo},
          ${ent.module},
          ${v.actionType},
          ${v.versionNumber},
          ${JSON.stringify(v.diffChanges || [])},
          ${JSON.stringify(v.snapshot || {})},
          ${isDeleted ? null : JSON.stringify(v.snapshot || {})},
          ${v.userId},
          ${v.userName},
          ${v.userRole},
          ${ent.countryId},
          ${ent.countryName},
          ${ent.cityBranchId},
          ${ent.branchName},
          ${"192.168.10.25"},
          ${"Windows 11 / Chrome 127"},
          ${`SID-${crypto.randomBytes(6).toString("hex")}`},
          ${v.approvalReference || "APP-8286-3344"},
          ${"72 Hours Granted"},
          ${"Approved"},
          ${v.riskLevel || (isDeleted ? "High" : "Low")},
          ${v.reviewStatus || (isDeleted ? "Pending" : "Reviewed")},
          ${v.reviewerComments || null},
          ${ent.partyName},
          ${ent.amount},
          ${ent.currency},
          ${v.reason},
          ${isDeleted},
          ${v.deletedAt || (isDeleted ? v.createdAt : null)},
          ${isDeleted ? v.userId : null},
          ${v.createdAt}::timestamptz
        )
        ON CONFLICT DO NOTHING;
      `;
    }
    console.log(`✓ Seeded ${ent.versions.length} versions for ${ent.referenceNo} (${ent.module})`);
  }

  console.log("\n🎉 Enterprise Audit & Deleted Records seed completed successfully!");
  await sql.end();
}

seedAuditData().catch(e => {
  console.error("Seed error:", e);
  process.exit(1);
});
