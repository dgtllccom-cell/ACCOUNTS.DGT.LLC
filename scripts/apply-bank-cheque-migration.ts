import { withLocalPg } from "../lib/db/local-postgres";
import fs from "fs";
import path from "path";

async function main() {
  const result = await withLocalPg(async (sql) => {
    // 1. Run migration SQL
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260816_bank_cheque_roznamcha_system.sql"),
      "utf8"
    );
    await sql.unsafe(migrationSql);
    console.log("Migration executed successfully.");

    // 2. Fetch master scopes to bind
    const companies = await sql`SELECT id, name FROM public.companies LIMIT 5`;
    const countries = await sql`SELECT id, name, currency_code FROM public.countries LIMIT 5`;
    const countryBranches = await sql`SELECT id, name, code, country_id FROM public.country_branches LIMIT 5`;
    const cityBranches = await sql`SELECT id, name, code, country_id FROM public.city_branches LIMIT 10`;
    const profiles = await sql`SELECT id, full_name FROM public.profiles LIMIT 5`;
    const banks = await sql`SELECT id, bank_name, short_name, currency FROM public.banks LIMIT 10`;

    const defaultCompany = companies[0]?.id || null;
    const pkCountry = countries.find((c) => c.name.toLowerCase().includes("pakistan")) || countries[0];
    const pkMainBranch = countryBranches.find((b) => b.name.toLowerCase().includes("pakistan")) || countryBranches[0];
    const cityBranch1 = cityBranches[0] || null;
    const cityBranch2 = cityBranches[1] || cityBranches[0] || null;
    const superAdmin = profiles.find((p) => (p.full_name || "").toLowerCase().includes("super")) || profiles[0];
    const adminName = superAdmin?.full_name || "Super Admin";

    // Clean existing test data if any
    await sql`DELETE FROM public.bank_cheque_transactions WHERE entry_serial_number LIKE 'ENT-%'`;

    // 3. Define sample test transactions matching the reference image and test cases
    const today = new Date().toISOString().slice(0, 10);
    
    // Calculate dates relative to today or standard May 2024 dates
    const rows = [
      {
        entry_serial_number: "ENT-0001",
        entry_date: "2024-05-01",
        entry_time: "2024-05-01T11:17:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "Habib Bank Limited",
        bank_code: "HBL",
        cheque_no: "CHK-000123",
        particulars: "Payment received from ABC Traders",
        cheque_date: "2024-05-01",
        due_date: "2024-05-03",
        debit: 0,
        credit: 150000.00,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-03T14:30:00Z",
        cleared_by: superAdmin?.id,
        notes: "Verified and credited to HBL main account"
      },
      {
        entry_serial_number: "ENT-0002",
        entry_date: "2024-05-01",
        entry_time: "2024-05-01T11:45:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "National Bank of Pakistan",
        bank_code: "NBP",
        cheque_no: "CHK-000124",
        particulars: "Cheque deposit - Customer payment",
        cheque_date: "2024-05-01",
        due_date: "2024-05-05",
        debit: 0,
        credit: 200000.00,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-05T10:15:00Z",
        cleared_by: superAdmin?.id,
        notes: "Cleared via NBP clearing house"
      },
      {
        entry_serial_number: "ENT-0003",
        entry_date: "2024-05-02",
        entry_time: "2024-05-02T09:22:00Z",
        branch_no: "BR-002",
        branch_name: "Main Branch",
        user_name: adminName,
        bank_name: "Bank Alfalah Limited",
        bank_code: "BAFL",
        cheque_no: "CHK-000125",
        particulars: "Supplier payment against invoice",
        cheque_date: "2024-05-02",
        due_date: "2024-05-04",
        debit: 75000.00,
        credit: 0,
        currency: "PKR",
        status: "pending",
        presented_at: "2024-05-02T10:00:00Z",
        notes: "Awaiting bank clearance"
      },
      {
        entry_serial_number: "ENT-0004",
        entry_date: "2024-05-02",
        entry_time: "2024-05-02T10:05:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "Habib Bank Limited",
        bank_code: "HBL",
        cheque_no: "CHK-000126",
        particulars: "Utility bill payment",
        cheque_date: "2024-05-02",
        due_date: "2024-05-06",
        debit: 25000.00,
        credit: 0,
        currency: "PKR",
        status: "dishonored",
        dishonored_at: "2024-05-06T15:00:00Z",
        dishonored_by: superAdmin?.id,
        dishonor_reason: "Insufficient funds in drawer account",
        notes: "Cheque returned unpaid by drawee branch"
      },
      {
        entry_serial_number: "ENT-0005",
        entry_date: "2024-05-03",
        entry_time: "2024-05-03T14:30:00Z",
        branch_no: "BR-002",
        branch_name: "Main Branch",
        user_name: adminName,
        bank_name: "United Bank Limited",
        bank_code: "UBL",
        cheque_no: "CHK-000127",
        particulars: "Cheque received from XYZ Ltd.",
        cheque_date: "2024-05-03",
        due_date: "2024-05-07",
        debit: 0,
        credit: 300000.00,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-07T12:00:00Z",
        cleared_by: superAdmin?.id,
        notes: "Approved and deposited"
      },
      {
        entry_serial_number: "ENT-0006",
        entry_date: "2024-05-03",
        entry_time: "2024-05-03T16:10:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "MCB Bank Limited",
        bank_code: "MCB",
        cheque_no: "CHK-000128",
        particulars: "Office expenses payment",
        cheque_date: "2024-05-03",
        due_date: "2024-05-03",
        debit: 50000.00,
        credit: 0,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-03T17:00:00Z",
        cleared_by: superAdmin?.id,
        notes: "Counter cash clearance"
      },
      {
        entry_serial_number: "ENT-0007",
        entry_date: "2024-05-04",
        entry_time: "2024-05-04T11:20:00Z",
        branch_no: "BR-002",
        branch_name: "Main Branch",
        user_name: adminName,
        bank_name: "Bank of Punjab",
        bank_code: "BOP",
        cheque_no: "CHK-000129",
        particulars: "Post dated cheque from PQR Co.",
        cheque_date: "2024-05-04",
        due_date: "2026-09-15", // Future date for post-dated
        debit: 0,
        credit: 500000.00,
        currency: "PKR",
        status: "post_dated",
        notes: "Future dated cheque received against security"
      },
      {
        entry_serial_number: "ENT-0008",
        entry_date: "2024-05-05",
        entry_time: "2024-05-05T09:15:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "Habib Bank Limited",
        bank_code: "HBL",
        cheque_no: "CHK-000130",
        particulars: "Salary payment",
        cheque_date: "2024-05-05",
        due_date: "2024-05-05",
        debit: 150000.00,
        credit: 0,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-05T14:00:00Z",
        cleared_by: superAdmin?.id,
        notes: "Executive staff salary"
      },
      {
        entry_serial_number: "ENT-0009",
        entry_date: "2024-05-06",
        entry_time: "2024-05-06T10:35:00Z",
        branch_no: "BR-002",
        branch_name: "Main Branch",
        user_name: adminName,
        bank_name: "National Bank of Pakistan",
        bank_code: "NBP",
        cheque_no: "CHK-000131",
        particulars: "Rent payment",
        cheque_date: "2024-05-06",
        due_date: "2024-05-06",
        debit: 80000.00,
        credit: 0,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-06T11:00:00Z",
        cleared_by: superAdmin?.id,
        notes: "Branch building rent for May"
      },
      {
        entry_serial_number: "ENT-0010",
        entry_date: "2024-05-07",
        entry_time: "2024-05-07T12:05:00Z",
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "MCB Bank Limited",
        bank_code: "MCB",
        cheque_no: "CHK-000132",
        particulars: "Customer refund",
        cheque_date: "2024-05-07",
        due_date: "2024-05-07",
        debit: 0,
        credit: 250000.00,
        currency: "PKR",
        status: "cleared",
        cleared_at: "2024-05-07T14:00:00Z",
        cleared_by: superAdmin?.id,
        notes: "Refund adjustment processed"
      },
      // Additional test rows for "Due Today" and "Overdue"
      {
        entry_serial_number: "ENT-0011",
        entry_date: today,
        entry_time: new Date().toISOString(),
        branch_no: "BR-001",
        branch_name: "Al Ras Branch",
        user_name: adminName,
        bank_name: "Meezan Bank",
        bank_code: "MEEZAN",
        cheque_no: "CHK-000133",
        particulars: "Import clearance fees cheque",
        cheque_date: today,
        due_date: today,
        debit: 120000.00,
        credit: 0,
        currency: "PKR",
        status: "pending",
        presented_at: new Date().toISOString(),
        notes: "Due today for customs clearance"
      },
      {
        entry_serial_number: "ENT-0012",
        entry_date: "2024-05-08",
        entry_time: "2024-05-08T09:00:00Z",
        branch_no: "BR-002",
        branch_name: "Main Branch",
        user_name: adminName,
        bank_name: "Bank Alfalah Limited",
        bank_code: "BAFL",
        cheque_no: "CHK-000134",
        particulars: "Overdue client security cheque",
        cheque_date: "2024-05-08",
        due_date: "2024-05-10",
        debit: 0,
        credit: 180000.00,
        currency: "PKR",
        status: "overdue",
        notes: "Passed maturity date without presentation/clearance"
      }
    ];

    for (const r of rows) {
      const cityBranch = r.branch_no === "BR-001" ? cityBranch1 : cityBranch2;
      const initialAudit: any[] = [
        {
          action: "created",
          actor: adminName,
          timestamp: r.entry_time,
          notes: "Initial cheque entry created"
        }
      ];
      if (r.status === "cleared") {
        initialAudit.push({
          action: "cleared",
          actor: adminName,
          timestamp: r.cleared_at || r.entry_time,
          notes: r.notes || "Cheque cleared and ledger posted"
        });
      } else if (r.status === "dishonored") {
        initialAudit.push({
          action: "dishonored",
          actor: adminName,
          timestamp: r.dishonored_at || r.entry_time,
          reason: r.dishonor_reason,
          notes: r.notes || "Dishonored by bank"
        });
      }

      await sql`
        INSERT INTO public.bank_cheque_transactions (
          company_id, country_id, country_branch_id, city_branch_id,
          entry_serial_number, entry_date, entry_time,
          user_id, user_name, bank_name, bank_code,
          cheque_no, particulars, cheque_date, due_date,
          debit, credit, currency, status,
          cleared_at, cleared_by, dishonored_at, dishonored_by, dishonor_reason, presented_at,
          notes, audit_trail
        ) VALUES (
          ${defaultCompany}, ${pkCountry?.id || null}, ${pkMainBranch?.id || null}, ${cityBranch?.id || null},
          ${r.entry_serial_number}, ${r.entry_date}, ${r.entry_time},
          ${superAdmin?.id || null}, ${r.user_name}, ${r.bank_name}, ${r.bank_code},
          ${r.cheque_no}, ${r.particulars}, ${r.cheque_date}, ${r.due_date},
          ${r.debit}, ${r.credit}, ${r.currency}, ${r.status},
          ${r.cleared_at || null}, ${r.cleared_by || null}, ${r.dishonored_at || null}, ${r.dishonored_by || null},
          ${r.dishonor_reason || null}, ${r.presented_at || null},
          ${r.notes || null}, ${JSON.stringify(initialAudit)}
        )
      `;
    }

    const count = await sql`SELECT count(*) FROM public.bank_cheque_transactions`;
    console.log(`Successfully seeded bank_cheque_transactions. Total count: ${count[0].count}`);
  });
}

main().catch(console.error);
