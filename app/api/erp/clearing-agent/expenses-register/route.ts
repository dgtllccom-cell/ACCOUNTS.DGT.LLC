import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

// Standard sample records matching the user's reference design
const MOCK_RECORDS = {
  customer: [
    { id: "1", expenseNo: "CE-2024-0001", date: "2024-09-01", country: "United Arab Emirates", countryCode: "AE", branch: "Dubai", entryUser: "Ali Khan", party: "Al Noor Trading LLC", expenseType: "Travel Expense", creditAccount: "4000-1001", debitAccount: "5100-2003", amount: 1250.00, currency: "USD", status: "approved" },
    { id: "2", expenseNo: "CE-2024-0002", date: "2024-09-02", country: "Pakistan", countryCode: "PK", branch: "Karachi", entryUser: "Sara Ahmed", party: "Faisal Enterprises", expenseType: "Marketing Expense", creditAccount: "4000-2002", debitAccount: "5100-3001", amount: 850.00, currency: "USD", status: "pending" },
    { id: "3", expenseNo: "CE-2024-0003", date: "2024-09-03", country: "Afghanistan", countryCode: "AF", branch: "Kabul", entryUser: "Mohammad Iqbal", party: "Kabul Star Ltd", expenseType: "Client Entertainment", creditAccount: "4000-3001", debitAccount: "5100-4002", amount: 620.00, currency: "USD", status: "approved" },
    { id: "4", expenseNo: "CE-2024-0004", date: "2024-09-04", country: "Uzbekistan", countryCode: "UZ", branch: "Tashkent", entryUser: "Nuriddin", party: "Tashkent Motors", expenseType: "Office Supplies", creditAccount: "4000-4001", debitAccount: "5100-5001", amount: 430.00, currency: "USD", status: "rejected" },
    { id: "5", expenseNo: "CE-2024-0005", date: "2024-09-05", country: "United Arab Emirates", countryCode: "AE", branch: "Abu Dhabi", entryUser: "Fatima Noor", party: "Desert Line LLC", expenseType: "Maintenance Expense", creditAccount: "4000-1003", debitAccount: "5100-2001", amount: 2100.00, currency: "USD", status: "approved" },
    { id: "6", expenseNo: "CE-2024-0006", date: "2024-09-06", country: "Pakistan", countryCode: "PK", branch: "Lahore", entryUser: "Imran Sheikh", party: "Royal Traders", expenseType: "Fuel Expense", creditAccount: "4000-2001", debitAccount: "5100-3003", amount: 690.00, currency: "USD", status: "pending" },
    { id: "7", expenseNo: "CE-2024-0007", date: "2024-09-07", country: "Afghanistan", countryCode: "AF", branch: "Mazar-i-Sharif", entryUser: "Zainab Malik", party: "Balkh Trading Co", expenseType: "Travel Expense", creditAccount: "4000-3002", debitAccount: "5100-4001", amount: 980.00, currency: "USD", status: "approved" },
    { id: "8", expenseNo: "CE-2024-0008", date: "2024-09-08", country: "Uzbekistan", countryCode: "UZ", branch: "Samarkand", entryUser: "Javlon Karimov", party: "UzAuto Parts", expenseType: "Marketing Expense", creditAccount: "4000-4002", debitAccount: "5100-5002", amount: 1340.00, currency: "USD", status: "rejected" },
    { id: "9", expenseNo: "CE-2024-0009", date: "2024-09-09", country: "United Arab Emirates", countryCode: "AE", branch: "Sharjah", entryUser: "Omar Abdullah", party: "Bright General Trading", expenseType: "Software & IT", creditAccount: "4000-1002", debitAccount: "5100-2004", amount: 760.00, currency: "USD", status: "approved" },
    { id: "10", expenseNo: "CE-2024-0010", date: "2024-09-10", country: "Pakistan", countryCode: "PK", branch: "Islamabad", entryUser: "Ayesha Siddiqui", party: "Metro Cash & Carry", expenseType: "Consultancy Fee", creditAccount: "4000-2003", debitAccount: "5100-3002", amount: 1520.00, currency: "USD", status: "pending" }
  ],
  truck: [
    { id: "1", expenseNo: "TE-2024-0001", date: "2024-09-01", country: "United Arab Emirates", countryCode: "AE", branch: "Dubai", entryUser: "Ali Khan", party: "TRK-7865 / Ahmad Khan", expenseType: "Driver Advance", creditAccount: "4000-1001", debitAccount: "5100-2003", amount: 1450.00, currency: "USD", status: "approved" },
    { id: "2", expenseNo: "TE-2024-0002", date: "2024-09-02", country: "Pakistan", countryCode: "PK", branch: "Karachi", entryUser: "Sara Ahmed", party: "TRK-4412 / Rashid Ali", expenseType: "Fuel & Diesel", creditAccount: "4000-2002", debitAccount: "5100-3001", amount: 920.00, currency: "USD", status: "pending" },
    { id: "3", expenseNo: "TE-2024-0003", date: "2024-09-03", country: "Afghanistan", countryCode: "AF", branch: "Kabul", entryUser: "Mohammad Iqbal", party: "TRK-9901 / Gul Khan", expenseType: "Toll Tax & Border Fee", creditAccount: "4000-3001", debitAccount: "5100-4002", amount: 580.00, currency: "USD", status: "approved" },
    { id: "4", expenseNo: "TE-2024-0004", date: "2024-09-04", country: "Uzbekistan", countryCode: "UZ", branch: "Tashkent", entryUser: "Nuriddin", party: "TRK-2234 / Sherzod", expenseType: "Truck Maintenance", creditAccount: "4000-4001", debitAccount: "5100-5001", amount: 640.00, currency: "USD", status: "rejected" },
    { id: "5", expenseNo: "TE-2024-0005", date: "2024-09-05", country: "United Arab Emirates", countryCode: "AE", branch: "Abu Dhabi", entryUser: "Fatima Noor", party: "TRK-8812 / Bilal Khan", expenseType: "Weighbridge & Parking", creditAccount: "4000-1003", debitAccount: "5100-2001", amount: 310.00, currency: "USD", status: "approved" },
    { id: "6", expenseNo: "TE-2024-0006", date: "2024-09-06", country: "Pakistan", countryCode: "PK", branch: "Lahore", entryUser: "Imran Sheikh", party: "TRK-3310 / Tariq Mehmood", expenseType: "Driver Allowance", creditAccount: "4000-2001", debitAccount: "5100-3003", amount: 480.00, currency: "USD", status: "pending" }
  ],
  customs: [
    { id: "1", expenseNo: "CB-2024-0001", date: "2024-09-01", country: "Pakistan", countryCode: "PK", branch: "Karachi", entryUser: "Sara Ahmed", party: "Karachi Customs Port", expenseType: "Customs Clearance & Duty", creditAccount: "4000-2002", debitAccount: "5100-3001", amount: 4200.00, currency: "USD", status: "approved" },
    { id: "2", expenseNo: "CB-2024-0002", date: "2024-09-02", country: "Afghanistan", countryCode: "AF", branch: "Kabul", entryUser: "Mohammad Iqbal", party: "Chaman / Spin Boldak Customs", expenseType: "Border Transit Duty", creditAccount: "4000-3001", debitAccount: "5100-4002", amount: 2850.00, currency: "USD", status: "approved" },
    { id: "3", expenseNo: "CB-2024-0003", date: "2024-09-03", country: "United Arab Emirates", countryCode: "AE", branch: "Dubai", entryUser: "Ali Khan", party: "Dubai Customs", expenseType: "Import Declaration Tariff", creditAccount: "4000-1001", debitAccount: "5100-2003", amount: 3600.00, currency: "USD", status: "approved" },
    { id: "4", expenseNo: "CB-2024-0004", date: "2024-09-04", country: "Uzbekistan", countryCode: "UZ", branch: "Tashkent", entryUser: "Nuriddin", party: "Tashkent Customs Terminal", expenseType: "Customs Inspection & Scan", creditAccount: "4000-4001", debitAccount: "5100-5001", amount: 1100.00, currency: "USD", status: "pending" }
  ],
  other: [
    { id: "1", expenseNo: "OE-2024-0001", date: "2024-09-01", country: "United Arab Emirates", countryCode: "AE", branch: "Dubai", entryUser: "Ali Khan", party: "Bureau Veritas Inspection", expenseType: "Lab Testing & SGS", creditAccount: "4000-1001", debitAccount: "5100-2003", amount: 890.00, currency: "USD", status: "approved" },
    { id: "2", expenseNo: "OE-2024-0002", date: "2024-09-02", country: "Pakistan", countryCode: "PK", branch: "Karachi", entryUser: "Sara Ahmed", party: "KICT Terminal Services", expenseType: "Terminal Handling Charges (THC)", creditAccount: "4000-2002", debitAccount: "5100-3001", amount: 1450.00, currency: "USD", status: "pending" },
    { id: "3", expenseNo: "OE-2024-0003", date: "2024-09-03", country: "Afghanistan", countryCode: "AF", branch: "Kabul", entryUser: "Mohammad Iqbal", party: "Kabul Insurance Corp", expenseType: "Cargo Transit Insurance", creditAccount: "4000-3001", debitAccount: "5100-4002", amount: 750.00, currency: "USD", status: "approved" },
    { id: "4", expenseNo: "OE-2024-0004", date: "2024-09-04", country: "Uzbekistan", countryCode: "UZ", branch: "Tashkent", entryUser: "Nuriddin", party: "Central Legal Consultancy", expenseType: "Legal & Notary Fees", creditAccount: "4000-4001", debitAccount: "5100-5001", amount: 520.00, currency: "USD", status: "rejected" }
  ]
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });

    const { searchParams } = new URL(req.url);
    const category = (searchParams.get("category") || "customer").toLowerCase();
    const country = searchParams.get("country");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") || "").toLowerCase();

    const baseList = MOCK_RECORDS[category as keyof typeof MOCK_RECORDS] || MOCK_RECORDS.customer;

    let filtered = baseList.filter((item) => {
      if (country && country !== "all" && item.countryCode !== country && item.country !== country) {
        return false;
      }
      if (status && status !== "all" && item.status !== status) {
        return false;
      }
      if (search) {
        const match =
          item.expenseNo.toLowerCase().includes(search) ||
          item.party.toLowerCase().includes(search) ||
          item.branch.toLowerCase().includes(search) ||
          item.expenseType.toLowerCase().includes(search) ||
          item.entryUser.toLowerCase().includes(search);
        if (!match) return false;
      }
      return true;
    });

    // Summary calculations
    const totalAmount = filtered.reduce((acc, cur) => acc + cur.amount, 0);
    const approvedAmount = filtered.filter((i) => i.status === "approved").reduce((acc, cur) => acc + cur.amount, 0);
    const pendingAmount = filtered.filter((i) => i.status === "pending").reduce((acc, cur) => acc + cur.amount, 0);
    const rejectedAmount = filtered.filter((i) => i.status === "rejected").reduce((acc, cur) => acc + cur.amount, 0);

    const summary = {
      totalAmount,
      totalCount: filtered.length,
      approvedAmount,
      approvedCount: filtered.filter((i) => i.status === "approved").length,
      pendingAmount,
      pendingCount: filtered.filter((i) => i.status === "pending").length,
      rejectedAmount,
      rejectedCount: filtered.filter((i) => i.status === "rejected").length
    };

    return NextResponse.json({
      success: true,
      category,
      summary,
      data: filtered
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("GET /api/erp/clearing-agent/expenses-register error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load expenses register." },
      { status: 500 }
    );
  }
}
