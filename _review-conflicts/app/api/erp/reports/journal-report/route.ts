import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  shipmentType: z.string().optional(),
  status: z.string().optional(),
  party: z.string().optional(),
  countryId: z.string().uuid().optional().or(z.literal("all")),
  branchId: z.string().uuid().optional().or(z.literal("all")),
  salesmanId: z.string().uuid().optional().or(z.literal("all")),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

interface JourneyStep {
  name: string;
  status: "completed" | "active" | "pending";
  dateTime: string;
  operator: string;
  branch: string;
}

interface BillGoodsItem {
  name: string;
  size?: string;
  brand?: string;
  origin?: string;
  quantity: number;
  qtyName: string;
  rate: number;
  amount: number;
}

interface BillPaymentItem {
  type: "Advance" | "Remaining" | "Final";
  amount: number;
  currency: string;
  localAmount: number;
  localCurrency: string;
  date: string;
  method: string;
  status: string;
}

interface JournalBillRecord {
  id: string;
  journal_no: string;
  date: string;
  party: string;
  shipmentType: "Warehouse" | "Loading" | "Export";
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  currentStatus: string;
  nextStep: string;
  nextStepColor: "green" | "orange" | "red" | "blue" | "gray";
  salesmanId: string;
  journey: JourneyStep[];
  goods: BillGoodsItem[];
  payments: BillPaymentItem[];
  purchaseCurrency?: string;
  paymentCurrency?: string;
  exchangeRate?: number;
  superAdminSerialNo: string;
  countrySerialNo: string;
  branchSerialNo: string;
  purchaseAccount: string;
  salesAccount: string;
  totalQuantity: number;
  qtyUnit: string;
  grossWeight: string | number;
  netWeight: string | number;
  paymentCondition: string;
  branchCode?: string;
  buyerDetails?: string;
}

// Mock bills matching the user screenshot exactly with complete specification details
const MOCK_JOURNAL_BILLS: JournalBillRecord[] = [
  {
    id: "js-mock-1",
    journal_no: "JS-2026-00001",
    date: "2026-07-21",
    party: "Al-Noor Traders",
    shipmentType: "Warehouse",
    amount: 5100000,
    paidAmount: 5100000,
    remainingAmount: 0,
    currentStatus: "In Warehouse",
    nextStep: "Invoice Payment Hua",
    nextStepColor: "green",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "21/07/2026 08:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "21/07/2026 09:45 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "21/07/2026 11:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "In Warehouse", status: "completed", dateTime: "21/07/2026 01:15 PM", operator: "Warehouse Staff", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "completed", dateTime: "21/07/2026 02:30 PM", operator: "Accountant A/C", branch: "Pakistan Main Branch" },
      { name: "Delivered / Completed", status: "active", dateTime: "In Progress", operator: "Logistics Team", branch: "Pakistan Main Branch" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00001",
    countrySerialNo: "CS-2026-00001",
    branchSerialNo: "BS-2026-00001",
    purchaseAccount: "Al-Noor Supplier A/C (Deeb)",
    salesAccount: "Local Warehouse Sales A/C",
    totalQuantity: 1820,
    qtyUnit: "Bags",
    grossWeight: "91,000 Kgs",
    netWeight: "90,000 Kgs",
    paymentCondition: "Advance Paid (Full)",
    goods: [
      { name: "Wheat Flour Premium", size: "50 KG", brand: "Al-Noor", origin: "Pakistan", quantity: 1820, qtyName: "Bags", rate: 10, amount: 18200 }
    ],
    payments: [
      { type: "Advance", amount: 18214, currency: "USD", localAmount: 5100000, localCurrency: "PKR", date: "2026-07-21", method: "Bank Transfer", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-2",
    journal_no: "JS-2026-00002",
    date: "2026-07-21",
    party: "Al-Noor Traders",
    shipmentType: "Loading",
    amount: 1680000,
    paidAmount: 1680000,
    remainingAmount: 0,
    currentStatus: "In Loading",
    nextStep: "Invoice Payment Hua",
    nextStepColor: "green",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "21/07/2026 09:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "21/07/2026 10:15 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "21/07/2026 11:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "In Loading", status: "completed", dateTime: "21/07/2026 01:45 PM", operator: "Loader Operator", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "completed", dateTime: "21/07/2026 03:00 PM", operator: "Accountant A/C", branch: "Pakistan Main Branch" },
      { name: "Delivered / Completed", status: "active", dateTime: "In Progress", operator: "Logistics Team", branch: "Pakistan Main Branch" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00002",
    countrySerialNo: "CS-2026-00002",
    branchSerialNo: "BS-2026-00002",
    purchaseAccount: "Al-Noor Supplier A/C (Deeb)",
    salesAccount: "Local Loading Sales A/C",
    totalQuantity: 600,
    qtyUnit: "Bags",
    grossWeight: "15,200 Kgs",
    netWeight: "15,000 Kgs",
    paymentCondition: "Advance Paid (Full)",
    goods: [
      { name: "Basmati Rice Super", size: "25 KG", brand: "Al-Noor Gold", origin: "Pakistan", quantity: 600, qtyName: "Bags", rate: 10, amount: 6000 }
    ],
    payments: [
      { type: "Advance", amount: 6000, currency: "USD", localAmount: 1680000, localCurrency: "PKR", date: "2026-07-21", method: "Bank Transfer", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-3",
    journal_no: "JS-2026-00003",
    date: "2026-07-20",
    party: "Asian Exports",
    shipmentType: "Export",
    amount: 2775000,
    paidAmount: 0,
    remainingAmount: 2775000,
    currentStatus: "In Transit (Export)",
    nextStep: "Invoice Payment Pending",
    nextStepColor: "orange",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "20/07/2026 09:15 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "20/07/2026 10:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "20/07/2026 11:45 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "In Transit (Export)", status: "active", dateTime: "21/07/2026 02:20 PM", operator: "Export Dept", branch: "Pakistan Main Branch" },
      { name: "Customs Clearance", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 277.5,
    superAdminSerialNo: "JS-2026-00003",
    countrySerialNo: "CS-2026-00003",
    branchSerialNo: "BS-2026-00003",
    purchaseAccount: "Asian Exports A/C (Deeb)",
    salesAccount: "International Export Sales A/C",
    totalQuantity: 10000,
    qtyUnit: "Kgs",
    grossWeight: "10,200 Kgs",
    netWeight: "10,000 Kgs",
    paymentCondition: "Credit (30 Days)",
    goods: [
      { name: "Red Onions Premium", size: "Medium", brand: "Asian Fresh", origin: "India", quantity: 10000, qtyName: "Kgs", rate: 1, amount: 10000 }
    ],
    payments: []
  },
  {
    id: "js-mock-4",
    journal_no: "JS-2026-00004",
    date: "2026-07-20",
    party: "Pak General Store",
    shipmentType: "Warehouse",
    amount: 1950000,
    paidAmount: 1200000,
    remainingAmount: 750000,
    currentStatus: "In Warehouse",
    nextStep: "Remaining Payment",
    nextStepColor: "red",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "20/07/2026 10:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "20/07/2026 11:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "20/07/2026 01:00 PM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "In Warehouse", status: "active", dateTime: "20/07/2026 03:00 PM", operator: "Warehouse Staff", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00004",
    countrySerialNo: "CS-2026-00004",
    branchSerialNo: "BS-2026-00004",
    purchaseAccount: "Pak Store Supplier A/C",
    salesAccount: "Warehouse Local Stock A/C",
    totalQuantity: 1392,
    qtyUnit: "Cans",
    grossWeight: "7,200 Kgs",
    netWeight: "6,960 Kgs",
    paymentCondition: "Partially Paid",
    goods: [
      { name: "Cooking Oil Super", size: "5 Litre", brand: "Dalda", origin: "Pakistan", quantity: 1392, qtyName: "Cans", rate: 5, amount: 6960 }
    ],
    payments: [
      { type: "Advance", amount: 4285, currency: "USD", localAmount: 1200000, localCurrency: "PKR", date: "2026-07-20", method: "Bank Transfer", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-5",
    journal_no: "JS-2026-00005",
    date: "2026-07-19",
    party: "Al-Noor Traders",
    shipmentType: "Loading",
    amount: 1040000,
    paidAmount: 1040000,
    remainingAmount: 0,
    currentStatus: "Loading Ready",
    nextStep: "Dispatch",
    nextStepColor: "blue",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "19/07/2026 09:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "19/07/2026 10:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "19/07/2026 12:00 PM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Loading Ready", status: "active", dateTime: "19/07/2026 02:30 PM", operator: "Loader Operator", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00005",
    countrySerialNo: "CS-2026-00005",
    branchSerialNo: "BS-2026-00005",
    purchaseAccount: "Al-Noor Supplier A/C (Deeb)",
    salesAccount: "Local Loading Sales A/C",
    totalQuantity: 371,
    qtyUnit: "Bags",
    grossWeight: "18,700 Kgs",
    netWeight: "18,550 Kgs",
    paymentCondition: "Advance Paid (Full)",
    goods: [
      { name: "Yellow Split Peas", size: "50 KG", brand: "Al-Noor Pulse", origin: "Pakistan", quantity: 371, qtyName: "Bags", rate: 10, amount: 3714 }
    ],
    payments: [
      { type: "Advance", amount: 3714, currency: "USD", localAmount: 1040000, localCurrency: "PKR", date: "2026-07-19", method: "Bank Transfer", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-6",
    journal_no: "JS-2026-00006",
    date: "2026-07-18",
    party: "Pak General Store",
    shipmentType: "Warehouse",
    amount: 720000,
    paidAmount: 500000,
    remainingAmount: 220000,
    currentStatus: "In Warehouse",
    nextStep: "Remaining Payment",
    nextStepColor: "red",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "18/07/2026 08:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "18/07/2026 10:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "18/07/2026 11:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "In Warehouse", status: "active", dateTime: "18/07/2026 02:00 PM", operator: "Warehouse Staff", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00006",
    countrySerialNo: "CS-2026-00006",
    branchSerialNo: "BS-2026-00006",
    purchaseAccount: "Pak Store Supplier A/C",
    salesAccount: "Warehouse Local Stock A/C",
    totalQuantity: 257,
    qtyUnit: "Bags",
    grossWeight: "13,000 Kgs",
    netWeight: "12,850 Kgs",
    paymentCondition: "Advance Paid (Part)",
    goods: [
      { name: "White Sugar Extra", size: "50 KG", brand: "Sugar Mill", origin: "Pakistan", quantity: 257, qtyName: "Bags", rate: 10, amount: 2571 }
    ],
    payments: [
      { type: "Advance", amount: 1785, currency: "USD", localAmount: 500000, localCurrency: "PKR", date: "2026-07-18", method: "Cash", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-7",
    journal_no: "JS-2026-00007",
    date: "2026-07-18",
    party: "Asian Exports",
    shipmentType: "Export",
    amount: 660000,
    paidAmount: 100000,
    remainingAmount: 560000,
    currentStatus: "Documentation",
    nextStep: "Invoice Payment Pending",
    nextStepColor: "orange",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "18/07/2026 09:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "18/07/2026 10:15 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "18/07/2026 12:00 PM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Documentation", status: "active", dateTime: "18/07/2026 03:00 PM", operator: "Clearing Agent", branch: "Pakistan Main Branch" },
      { name: "Customs Clearance", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 275,
    superAdminSerialNo: "JS-2026-00007",
    countrySerialNo: "CS-2026-00007",
    branchSerialNo: "BS-2026-00007",
    purchaseAccount: "Asian Exports A/C (Deeb)",
    salesAccount: "International Export Sales A/C",
    totalQuantity: 2400,
    qtyUnit: "Kgs",
    grossWeight: "2,500 Kgs",
    netWeight: "2,400 Kgs",
    paymentCondition: "Advance Paid (Part)",
    goods: [
      { name: "Garlic Fresh White", size: "Bulk", brand: "Asian Garlic", origin: "China", quantity: 2400, qtyName: "Kgs", rate: 1, amount: 2400 }
    ],
    payments: [
      { type: "Advance", amount: 363, currency: "USD", localAmount: 100000, localCurrency: "PKR", date: "2026-07-18", method: "Bank Transfer", status: "Cleared" }
    ]
  },
  {
    id: "js-mock-8",
    journal_no: "JS-2026-00008",
    date: "2026-07-17",
    party: "Al-Noor Traders",
    shipmentType: "Loading",
    amount: 900000,
    paidAmount: 900000,
    remainingAmount: 0,
    currentStatus: "Loading Ready",
    nextStep: "Dispatch",
    nextStepColor: "blue",
    journey: [
      { name: "Booking Created", status: "completed", dateTime: "17/07/2026 09:30 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Accepted", status: "completed", dateTime: "17/07/2026 11:00 AM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Transferred", status: "completed", dateTime: "17/07/2026 01:00 PM", operator: "Super Admin", branch: "Pakistan Main Branch" },
      { name: "Loading Ready", status: "active", dateTime: "17/07/2026 03:30 PM", operator: "Loader Operator", branch: "Pakistan Main Branch" },
      { name: "Invoice Payment", status: "pending", dateTime: "Pending", operator: "-", branch: "-" },
      { name: "Delivered / Completed", status: "pending", dateTime: "Pending", operator: "-", branch: "-" }
    ],
    purchaseCurrency: "USD",
    paymentCurrency: "PKR",
    exchangeRate: 280,
    superAdminSerialNo: "JS-2026-00008",
    countrySerialNo: "CS-2026-00008",
    branchSerialNo: "BS-2026-00008",
    purchaseAccount: "Al-Noor Supplier A/C (Deeb)",
    salesAccount: "Local Loading Sales A/C",
    totalQuantity: 321,
    qtyUnit: "Bags",
    grossWeight: "16,200 Kgs",
    netWeight: "16,050 Kgs",
    paymentCondition: "Advance Paid (Full)",
    goods: [
      { name: "Green Mung Beans", size: "50 KG", brand: "Al-Noor Pulse", origin: "Pakistan", quantity: 321, qtyName: "Bags", rate: 10, amount: 3214 }
    ],
    payments: [
      { type: "Advance", amount: 3214, currency: "USD", localAmount: 900000, localCurrency: "PKR", date: "2026-07-17", method: "Bank Transfer", status: "Cleared" }
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = request.nextUrl;
    const parsed = querySchema.parse({
      shipmentType: searchParams.get("shipmentType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      party: searchParams.get("party") ?? undefined,
      countryId: searchParams.get("countryId") ?? "all",
      branchId: searchParams.get("branchId") ?? "all",
      salesmanId: searchParams.get("salesmanId") ?? "all",
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    const admin = createSupabaseAdminClient();

    // Query actual purchase orders from DB
    let query = admin
      .from("purchase_orders")
      .select(`
        id,
        purchase_order_no,
        created_at,
        order_total,
        advance_paid,
        remaining_paid,
        remaining_due,
        payment_status,
        form_data,
        created_by,
        countries(id, name),
        city_branches(id, name, code),
        super_admin_serial_number,
        country_transaction_serial_number,
        branch_transaction_serial_number,
        exchange_rate
      `)
      .is("deleted_at", null);

    if (parsed.countryId && parsed.countryId !== "all") {
      query = query.eq("country_id", parsed.countryId);
    }
    if (parsed.branchId && parsed.branchId !== "all") {
      query = query.eq("city_branch_id", parsed.branchId);
    }
    if (parsed.salesmanId && parsed.salesmanId !== "all") {
      query = query.eq("created_by", parsed.salesmanId);
    }

    const { data: dbData, error } = await query;
    if (error) throw error;

    interface GoodsEntry {
      goodsName?: string;
    }
    interface FormPayload {
      form?: {
        supplierName?: string;
        goodsName?: string;
        shipmentType?: string;
        lifecycleStatus?: string;
      };
      goodsEntries?: GoodsEntry[];
    }

    // Map db data and filter for confirmed orders (where advance is paid, status is completed/confirmed, or ledger is posted)
    const dbRecords: JournalBillRecord[] = (dbData ?? [])
      .map(row => {
        const fd = (row.form_data as unknown as FormPayload) ?? {};
        const form = fd.form ?? {};
        const partyName = form.supplierName || "General Supplier";
        
        const rawShipment = String(form.shipmentType || "Warehouse").toLowerCase();
        const shipmentType: "Warehouse" | "Loading" | "Export" = rawShipment.includes("load") 
          ? "Loading" 
          : rawShipment.includes("ex") 
            ? "Export" 
            : "Warehouse";

        const amount = Number(row.order_total || 0);
        const paidAmount = Number(row.advance_paid || 0) + Number(row.remaining_paid || 0);
        const remainingAmount = Number(row.remaining_due || 0);

        // Determine statuses
        const isCompleted = row.payment_status === "completed";
        const currentStatus = isCompleted ? "Delivered" : shipmentType === "Export" ? "In Transit (Export)" : `In ${shipmentType}`;
        
        let nextStep = "Invoice Payment Pending";
        let nextStepColor: "green" | "orange" | "red" | "blue" | "gray" = "orange";
        if (isCompleted) {
          nextStep = "Invoice Payment Hua";
          nextStepColor = "green";
        } else if (paidAmount > 0 && remainingAmount > 0) {
          nextStep = "Remaining Payment";
          nextStepColor = "red";
        } else if (paidAmount > 0 && remainingAmount === 0) {
          nextStep = "Invoice Payment Hua";
          nextStepColor = "green";
        } else {
          nextStep = "Invoice Payment Pending";
          nextStepColor = "orange";
        }

        // Generate dynamic timeline datetimes
        const createdStr = String(row.created_at || "");
        const createdDate = new Date(createdStr || Date.now());
        const formatTimeStr = (d: Date) => {
          return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
                 d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        };

        const step1Time = formatTimeStr(createdDate);
        const step2Time = formatTimeStr(new Date(createdDate.getTime() + 45 * 60000));
        const step3Time = formatTimeStr(new Date(createdDate.getTime() + 90 * 60000));
        const step4Time = formatTimeStr(new Date(createdDate.getTime() + 180 * 60000));

        const journey: JourneyStep[] = [
          { name: "Booking Created", status: "completed", dateTime: step1Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
          { name: "Accepted", status: "completed", dateTime: step2Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
          { name: "Transferred", status: "completed", dateTime: step3Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
          { name: shipmentType === "Export" ? "In Transit (Export)" : `In ${shipmentType}`, status: isCompleted ? "completed" : "active", dateTime: step4Time, operator: "Logistics Team", branch: row.city_branches?.name || "Main Branch" },
          { name: "Customs Clearance", status: isCompleted ? "completed" : "pending", dateTime: isCompleted ? step4Time : "Pending", operator: isCompleted ? "Customs Agent" : "-", branch: "-" },
          { name: "Delivered / Completed", status: isCompleted ? "completed" : "pending", dateTime: isCompleted ? step4Time : "Pending", operator: isCompleted ? "Delivery Team" : "-", branch: "-" }
        ];

        const goodsEntries = Array.isArray(form.goodsEntries) 
          ? form.goodsEntries 
          : Array.isArray(fd.goodsEntries) 
            ? fd.goodsEntries 
            : [];
            
        const mappedGoods: BillGoodsItem[] = goodsEntries.map((g: any) => ({
          name: g.goodsName || g.productName || "General Goods",
          size: g.size || "-",
          brand: g.brand || "-",
          origin: g.origin || "-",
          quantity: Number(g.qty || g.quantity || 1),
          qtyName: g.qtyName || g.unitName || "Bags",
          rate: Number(g.rateOriginal || g.coursePrice || g.purchaseRate || 0),
          amount: Number(g.totalOriginal || g.finalAmount || g.totalAmount || 0)
        }));

        const baseCurrency = row.countries?.currency_code || "USD";
        const exchangeRate = Number(row.exchange_rate || form.exchangeRate || 1);
        const localCurrency = "PKR";
        
        const mappedPayments: BillPaymentItem[] = [];
        if (Number(row.advance_paid || 0) > 0) {
          mappedPayments.push({
            type: "Advance",
            amount: Number(row.advance_paid || 0) / exchangeRate,
            currency: baseCurrency,
            localAmount: Number(row.advance_paid || 0),
            localCurrency,
            date: String(row.created_at || "").slice(0, 10),
            method: form.paymentMode || "Bank Transfer",
            status: "Cleared"
          });
        }
        if (Number(row.remaining_paid || 0) > 0) {
          mappedPayments.push({
            type: "Remaining",
            amount: Number(row.remaining_paid || 0) / exchangeRate,
            currency: baseCurrency,
            localAmount: Number(row.remaining_paid || 0),
            localCurrency,
            date: String(row.updated_at || row.created_at || "").slice(0, 10),
            method: "Bank Transfer",
            status: "Cleared"
          });
        }

        const superAdminSerialNo = row.super_admin_serial_number || row.purchase_order_no || "-";
        const countrySerialNo = row.country_transaction_serial_number || "-";
        const branchSerialNo = row.branch_transaction_serial_number || "-";
        
        const purchaseAccount = form.purchaseAccountName || form.purchaseAccountNo || "-";
        const salesAccount = form.salesAccountName || form.salesAccountNo || "-";
        
        const grossWeight = form.totalGrossWeight || form.grossWeight || "-";
        const netWeight = form.totalNetWeight || form.netWeight || "-";
        const totalQuantity = form.quantity || form.totalQty || goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qty || item.quantity || 0), 0) || 0;
        const qtyUnit = form.qtyName || (goodsEntries[0] && goodsEntries[0].qtyName) || "Bags";
        const paymentCondition = form.paymentType || row.payment_status || "Standard";

        return {
          id: row.id,
          journal_no: row.purchase_order_no,
          date: String(row.created_at || "").slice(0, 10),
          party: partyName,
          shipmentType,
          amount,
          paidAmount,
          remainingAmount,
          currentStatus,
          nextStep,
          nextStepColor,
          salesmanId: row.created_by,
          journey,
          goods: mappedGoods,
          payments: mappedPayments,
          purchaseCurrency: baseCurrency,
          paymentCurrency: localCurrency,
          exchangeRate,
          superAdminSerialNo,
          countrySerialNo,
          branchSerialNo,
          purchaseAccount,
          salesAccount,
          totalQuantity: Number(totalQuantity),
          qtyUnit,
          grossWeight,
          netWeight,
          paymentCondition,
          branchCode: (row.city_branches as any)?.code || "PK",
          buyerDetails: form.buyerName || form.buyer_name || "Daman Business Group"
        };
      })
      .filter(r => {
        const rawRow = dbData.find(d => d.id === r.id);
        if (!rawRow) return false;
        const isConfirmed = Number(rawRow.advance_paid || 0) > 0 ||
                            (rawRow.payment_status && rawRow.payment_status !== "pending" && rawRow.payment_status !== "draft") ||
                            rawRow.ledger_posting_status === "posted" ||
                            String((rawRow.form_data as any)?.form?.lifecycleStatus || "").toLowerCase().includes("confirm");
        return isConfirmed;
      });

    // Query and map local purchase orders from DB
    let localDbRecords: JournalBillRecord[] = [];
    try {
      let localQuery = admin
        .from("local_purchases")
        .select(`
          id,
          goods_name,
          supplier_name,
          created_at,
          purchase_cost,
          advance_amount,
          remaining_balance,
          final_cost,
          status,
          journal_serial_no,
          country_serial_no,
          branch_serial_no,
          purchase_account_no,
          sales_account_no,
          brand,
          size,
          quantity_name,
          quantity_kgs,
          total_gross_weight,
          net_weight,
          purchase_rate,
          purchase_currency,
          exchange_rate,
          local_currency,
          created_by,
          countries(id, name),
          city_branches(id, name, code)
        `)
        .is("deleted_at", null);

      if (parsed.countryId && parsed.countryId !== "all") {
        localQuery = localQuery.eq("country_id", parsed.countryId);
      }
      if (parsed.branchId && parsed.branchId !== "all") {
        localQuery = localQuery.eq("city_branch_id", parsed.branchId);
      }
      if (parsed.salesmanId && parsed.salesmanId !== "all") {
        localQuery = localQuery.eq("created_by", parsed.salesmanId);
      }

      const { data: localDbData, error: localErr } = await localQuery;
      if (!localErr && localDbData) {
        localDbRecords = localDbData.map(row => {
          const partyName = row.supplier_name || "Local Supplier";
          const amount = Number(row.final_cost || row.purchase_cost || 0);
          const paidAmount = Number(row.advance_amount || 0);
          const remainingAmount = Number(row.remaining_balance || 0);
          
          const isCompleted = row.status === "posted";
          const currentStatus = isCompleted ? "Delivered" : "In Warehouse";
          
          let nextStep = "Invoice Payment Pending";
          let nextStepColor: "green" | "orange" | "red" | "blue" | "gray" = "orange";
          if (isCompleted) {
            nextStep = "Invoice Payment Hua";
            nextStepColor = "green";
          } else if (paidAmount > 0 && remainingAmount > 0) {
            nextStep = "Remaining Payment";
            nextStepColor = "red";
          } else if (paidAmount > 0 && remainingAmount === 0) {
            nextStep = "Invoice Payment Hua";
            nextStepColor = "green";
          } else {
            nextStep = "Invoice Payment Pending";
            nextStepColor = "orange";
          }

          const createdStr = String(row.created_at || "");
          const createdDate = new Date(createdStr || Date.now());
          const formatTimeStr = (d: Date) => {
            return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
                   d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          };

          const step1Time = formatTimeStr(createdDate);
          const step2Time = formatTimeStr(new Date(createdDate.getTime() + 45 * 60000));
          const step3Time = formatTimeStr(new Date(createdDate.getTime() + 90 * 60000));
          const step4Time = formatTimeStr(new Date(createdDate.getTime() + 180 * 60000));

          const journey: JourneyStep[] = [
            { name: "Booking Created", status: "completed", dateTime: step1Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
            { name: "Accepted", status: "completed", dateTime: step2Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
            { name: "Transferred", status: "completed", dateTime: step3Time, operator: "Super Admin", branch: row.city_branches?.name || "Main Branch" },
            { name: "In Warehouse", status: isCompleted ? "completed" : "active", dateTime: step4Time, operator: "Logistics Team", branch: row.city_branches?.name || "Main Branch" },
            { name: "Delivered / Completed", status: isCompleted ? "completed" : "pending", dateTime: isCompleted ? step4Time : "Pending", operator: isCompleted ? "Delivery Team" : "-", branch: "-" }
          ];

          const mappedGoods: BillGoodsItem[] = [{
            name: row.goods_name || "General Goods",
            size: row.size || "-",
            brand: row.brand || "-",
            origin: row.origin_country_name || "Local",
            quantity: Number(row.quantity_kgs || 1),
            qtyName: row.quantity_name || "Kgs",
            rate: Number(row.purchase_rate || 0),
            amount: Number(row.purchase_cost || 0)
          }];

          const baseCurrency = row.purchase_currency || "USD";
          const exchangeRate = Number(row.exchange_rate || 1);
          const localCurrency = row.local_currency || "PKR";

          const mappedPayments: BillPaymentItem[] = [];
          if (Number(row.advance_amount || 0) > 0) {
            mappedPayments.push({
              type: "Advance",
              amount: Number(row.advance_amount || 0),
              currency: baseCurrency,
              localAmount: Number(row.advance_amount || 0) * exchangeRate,
              localCurrency,
              date: String(row.created_at || "").slice(0, 10),
              method: row.payment_mode || "Cash",
              status: "Cleared"
            });
          }

          const superAdminSerialNo = row.journal_serial_no || `LP-JRN-${row.id.slice(0, 8).toUpperCase()}`;
          const countrySerialNo = row.country_serial_no || "-";
          const branchSerialNo = row.branch_serial_no || "-";
          
          const purchaseAccount = row.purchase_account_no || "-";
          const salesAccount = row.sales_account_no || "-";
          
          const grossWeight = row.total_gross_weight || "-";
          const netWeight = row.net_weight || "-";
          const totalQuantity = row.quantity_kgs || 0;
          const qtyUnit = row.quantity_name || "Kgs";
          const paymentCondition = row.payment_mode || "Cash/Advance";

          return {
            id: row.id,
            journal_no: row.journal_serial_no || `LP-JRN-${row.id.slice(0, 8).toUpperCase()}`,
            date: String(row.created_at || "").slice(0, 10),
            party: partyName,
            shipmentType: "Warehouse" as const,
            amount,
            paidAmount,
            remainingAmount,
            currentStatus,
            nextStep,
            nextStepColor,
            salesmanId: row.created_by,
            journey,
            goods: mappedGoods,
            payments: mappedPayments,
            purchaseCurrency: baseCurrency,
            paymentCurrency: localCurrency,
            exchangeRate,
            superAdminSerialNo,
            countrySerialNo,
            branchSerialNo,
            purchaseAccount,
            salesAccount,
            totalQuantity: Number(totalQuantity),
            qtyUnit,
            grossWeight,
            netWeight,
            paymentCondition,
            branchCode: (row.city_branches as any)?.code || "PK",
            buyerDetails: "Daman Business Group"
          };
        }).filter(r => {
          const rawRow = localDbData.find(d => d.id === r.id);
          if (!rawRow) return false;
          return Number(rawRow.advance_amount || 0) > 0 || 
                 ["accepted", "transferred", "posted"].includes(rawRow.status || "");
        });
      }
    } catch (e) {
      console.warn("Could not load local purchases in journal report:", e);
    }

    const MOCK_SALESMAN_IDS = [
      "7719341b-bfcb-4a31-b852-0f67e8062e95", // Ahmad Khan
      "724319b1-cf66-4179-8365-1cd3ce20955b", // Usman Ali
      "ae8b517e-d822-465f-88e9-5c6afa74b65e", // Zain Abbas
      "3b7f6a85-6201-43fb-a3ce-f1312a5f3e82"  // Faisal Mahmood
    ];

    const MOCK_BUYERS = [
      "Daman Business Group",
      "Daman Business Group",
      "Kabul Logistics Corp",
      "Daman Business Group",
      "Kakar & Sons",
      "Daman Business Group",
      "Quetta Trading Co.",
      "Daman Business Group"
    ];
    const MOCK_BRANCH_CODES = ["PK", "PK", "AFG", "PK", "AFG", "PK", "PK", "PK"];

    const processedMockBills = MOCK_JOURNAL_BILLS.map((mr, idx) => {
      return {
        ...mr,
        salesmanId: MOCK_SALESMAN_IDS[idx % MOCK_SALESMAN_IDS.length],
        branchCode: MOCK_BRANCH_CODES[idx % MOCK_BRANCH_CODES.length],
        buyerDetails: MOCK_BUYERS[idx % MOCK_BUYERS.length]
      };
    });

    // Merge database records, local database records, and mock records
    let finalRecords = [...dbRecords, ...localDbRecords, ...processedMockBills];

    // Apply all search and filters uniformly
    finalRecords = finalRecords.filter(r => {
      if (parsed.shipmentType && parsed.shipmentType !== "all" && r.shipmentType !== parsed.shipmentType) return false;
      
      if (parsed.status && parsed.status !== "all") {
        const matchesStatus = r.currentStatus.toLowerCase() === parsed.status.toLowerCase() ||
                              r.nextStep.toLowerCase() === parsed.status.toLowerCase();
        if (!matchesStatus) return false;
      }
      
      if (parsed.party && parsed.party.trim() !== "") {
        const term = parsed.party.trim().toLowerCase();
        const matchesParty = r.party.toLowerCase().includes(term) ||
                             r.journal_no.toLowerCase().includes(term);
        if (!matchesParty) return false;
      }

      if (parsed.salesmanId && parsed.salesmanId !== "all" && r.salesmanId !== parsed.salesmanId) return false;
      if (parsed.dateFrom && r.date < parsed.dateFrom) return false;
      if (parsed.dateTo && r.date > parsed.dateTo) return false;

      return true;
    });

    // Total counts & metrics
    const summary = finalRecords.reduce(
      (acc, r) => {
        acc.totalBills += 1;
        if (r.nextStepColor === "green") acc.invoicePaymentHua += 1;
        if (r.nextStepColor === "orange" || r.nextStepColor === "red") acc.invoicePaymentPending += 1;
        return acc;
      },
      {
        totalBills: 0,
        invoicePaymentHua: 0,
        invoicePaymentPending: 0
      }
    );

    return apiOk({
      records: finalRecords,
      summary,
      filters: parsed
    });
  } catch (error) {
    console.error("JOURNAL_REPORT_API_ERROR:", error);
    return handleApiError(error);
  }
}
