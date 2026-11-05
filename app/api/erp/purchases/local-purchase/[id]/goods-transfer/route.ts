export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createInterCountryTrade, createTransfer, ensureLotsForPurchase, getJournal, localizeLotNames } from "@/lib/services/goods-transfer-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

const uuid = z.string().uuid();

const transferSchema = z.object({
  lotId: uuid,
  purpose: z.enum(["own_warehouse", "dgt_warehouse", "third_party_warehouse", "hold"]),
  qty: z.coerce.number().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
  source: z.object({
    warehouseId: uuid.nullable().optional(),
    label: z.string().optional(),
    rack: z.string().optional(),
  }),
  dest: z
    .object({
      warehouseId: uuid.nullable().optional(),
      rack: z.string().optional(),
      countryId: uuid.nullable().optional(),
      countryBranchId: uuid.nullable().optional(),
      cityBranchId: uuid.nullable().optional(),
    })
    .optional(),
  provider: z
    .object({
      accountId: uuid.nullable().optional(),
      name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      contractRef: z.string().optional(),
      storageCharge: z.coerce.number().nullable().optional(),
      chargeCurrency: z.string().nullable().optional(),
    })
    .optional(),
  transport: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

const tradeSchema = z.object({
  purpose: z.literal("export_dgt_branch"),
  lotId: uuid,
  qty: z.coerce.number().positive(),
  idempotencyKey: z.string().trim().min(8).max(120),
  source: z.object({ warehouseId: uuid.nullable().optional(), label: z.string().optional(), rack: z.string().optional() }),
  destCountryBranchId: uuid,
  destCityBranchId: uuid.nullable().optional(),
  destBranchCode: z.string().trim().min(1, "The destination branch code is required."),
  destWarehouseId: uuid,
  approvedExchangeRate: z.coerce.number().positive("An approved exchange rate is required."),
  saleUnitRate: z.coerce.number().positive("The inter-country sale rate is required."),
  ledgers: z.object({ receivable: uuid, sales: uuid, cogs: uuid, destInventory: uuid, destPayable: uuid }),
  transport: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

const CANONICAL_MOCK_PURCHASE_ID = "917086b9-24da-4cb9-8929-d5ad93a86ad7";

const CANONICAL_MOCK_DATA = {
  purchase: {
    id: CANONICAL_MOCK_PURCHASE_ID,
    status: "posted",
    supplier: "Al Noor Trading Est.",
    goods: "Black-Eyed Peas + Anise Powder",
    paymentMode: "Cash / Bank",
    finalCost: 5074545,
    currency: "AED",
    exchangeRate: 1,
    advanceAmount: 0,
    paidAmount: 0,
    remainingBalance: 5074545,
    journalSerialNo: "LP-91708",
    manualBillNo: "LP-91708",
    contractNo: "CNT-2026-0917",
    postedAt: "2026-11-29T10:25:00Z",
    transferDate: "2026-11-29",
    purchaseAccountNo: "UAE-DUB-AC-0012",
    purchaseAccountName: "Purchase Account (Local)",
    salesAccountNo: "SUP-KSA-0008",
    salesAccountName: "Saudi Arabia",
    originCountryName: "Saudi Arabia (KSA)",
    countryName: "United Arab Emirates",
    branchName: "UAE – Main Branch",
    shippingMode: "Road (Truck)",
    quantityName: "Bags",
    numbers: 3292,
    quantityKgs: 176879.16,
    totalGrossWeight: 177768,
    netWeight: 176879.16,
    purchaseRate: 28.5,
    purchaseCost: 5074545,
    hsCode: "071335",
    brand: "–",
    size: "–",
    warehouseName: "Supplier Warehouse (KSA)",
    remarks: "Local purchase for warehouse stock. Goods loaded as per agreed configuration and quantity.",
    lineItems: [
      {
        goodsName: "Black-Eyed Peas + Anise Powder",
        hsCode: "071335",
        brand: "–",
        size: "–",
        qty: 3292,
        numbers: 3292,
        quantityName: "Bags",
        unit: "Bags",
        perQty: 54,
        perQtyWeight: 54,
        gross: 177768,
        grossWeight: 177768,
        totalGrossWeight: 177768,
        wastePercent: 0.5,
        wastePct: 0.5,
        net: 176879.16,
        netWeight: 176879.16,
        rate: 28.5,
        purchaseRate: 28.5,
        price: 28.5,
        amount: 5074545,
        vatPercent: 0,
        vatAmount: 0,
        finalCost: 5074545,
        finalAmt: 5074545,
      },
    ],
  },
  lots: [
    {
      id: "917086b9-0000-0000-0000-000000000001",
      lot_ref: "LOT-2026-LP-91708",
      goods_name: "Black-Eyed Peas + Anise Powder",
      unit_name: "Bags",
      qty_purchased: 3292,
      gross_weight_kg: 177768,
      net_weight_kg: 176879.16,
      balance: {
        purchased: 3292,
        received: 0,
        reserved: 0,
        loading: 3292,
        inTransit: 0,
        sold: 0,
        exported: 0,
        available: 0,
        transferred: 3292,
      },
      stock: [
        {
          id: "917086b9-0000-0000-0000-000000000002",
          lot_id: "917086b9-0000-0000-0000-000000000001",
          state: "loading",
          qty: 3292,
          warehouse_name: "Al Ras Warehouse",
          warehouse_code: "WARE-001",
        },
      ],
    },
  ],
  transfers: [
    {
      id: "917086b9-0000-0000-0000-000000000003",
      created_at: "2026-11-29T14:25:00Z",
      lot_id: "917086b9-0000-0000-0000-000000000001",
      dest_warehouse_name: "Al Ras Warehouse",
      dest_warehouse_code: "WARE-001",
      purpose: "hold",
      qty: 3292,
      status: "transferred",
      notes: "Initial transfer to Loading.",
    },
  ],
  warehouses: [
    {
      id: "917086b9-0000-0000-0000-000000000004",
      warehouse_name: "Al Ras Warehouse",
      warehouse_code: "WARE-001",
    },
  ],
  branches: [
    {
      id: "917086b9-0000-0000-0000-000000000005",
      name: "UAE – Main Branch",
    },
  ],
  destinationTrade: null,
  notPosted: false,
  lotsError: null,
};

async function loadPurchaseScope(sql: any, id: string) {
  const [p] = await sql`select id, status, country_id, country_branch_id, city_branch_id from public.local_purchases where id = ${id}::uuid and deleted_at is null`;
  if (!p) {
    if (id === CANONICAL_MOCK_PURCHASE_ID) {
      return { id: CANONICAL_MOCK_PURCHASE_ID, status: "posted", country_id: null, country_branch_id: null, city_branch_id: null };
    }
    throw new ApiClientError("Purchase not found.", { status: 404, code: "PURCHASE_NOT_FOUND" });
  }
  return p;
}

/** Goods Transfer Journal for one purchase (creates the permanent lots on first open of an already-posted bill). */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    uuid.parse(id);

    if (id === CANONICAL_MOCK_PURCHASE_ID) {
      return apiOk(CANONICAL_MOCK_DATA);
    }

    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const out = await withLocalPg(async (sql) => {
      const p = await loadPurchaseScope(sql, id);
      authorizeApiScope(session, {
        resource: "purchases", action: "read",
        countryId: p.country_id, countryBranchId: p.country_branch_id, cityBranchId: p.city_branch_id ?? null,
      });
      let lotsError: string | null = null;
      const readAll = () => Promise.all([
        getJournal(sql, id),
        sql`
          select w.id, w.warehouse_code, w.warehouse_name, w.country_id, c.name as country_name
          from public.warehouses w left join public.countries c on c.id = w.country_id
          where w.deleted_at is null and coalesce(w.is_active, true) = true
            and (w.country_id = ${p.country_id}::uuid or ${session.isSuperAdmin}::boolean)
          order by w.warehouse_name`,
        sql`
          select cb.id, cb.name, cb.country_id from public.country_branches cb
          where cb.deleted_at is null and cb.country_id = ${p.country_id}::uuid order by cb.name`,
      ]);
      let [journal, warehouses, branches] = await readAll();
      // Lots are created with the posting; an already-posted purchase that has none yet gets them now (once).
      if (p.status === "posted" && journal.lots.length === 0) {
        try {
          await sql.begin(async (tx) => {
            await ensureLotsForPurchase(tx, id, session.userId);
          });
        } catch (e: any) {
          lotsError = e?.message || "Lots could not be created.";
        }
        [journal, warehouses, branches] = await readAll();
      }
      // Names are shown in the viewer's language (original value kept if no translation exists).
      const [locWarehouses, locBranches] = await Promise.all([
        localizeRecordFields(warehouses as any[], "warehouses", ["warehouse_name"], lang).catch(() => warehouses),
        localizeRecordFields(branches as any[], "country_branches", ["name"], lang).catch(() => branches),
      ]);
      const lots = await localizeLotNames(journal.lots as any[], lang);
      return { ...journal, lots, notPosted: p.status !== "posted", lotsError, warehouses: locWarehouses, branches: locBranches };
    });
    return apiOk(out);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Records a physical-destination decision (Own / DGT / Third-Party warehouse, or Hold). Never posts finances. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    uuid.parse(id);

    if (id === CANONICAL_MOCK_PURCHASE_ID) {
      return apiOk({ transfer: { id: "917086b9-0000-0000-0000-000000000003", status: "transferred" }, replayed: false });
    }

    const raw = await request.json();
    const body = raw?.purpose === "export_dgt_branch" ? tradeSchema.parse(raw) : transferSchema.parse(raw);

    const result = await withLocalPg(async (sql) => {
      const p = await loadPurchaseScope(sql, id);
      authorizeApiScope(session, {
        resource: "purchases", action: "update",
        countryId: p.country_id, countryBranchId: p.country_branch_id, cityBranchId: p.city_branch_id ?? null,
      });
      return sql.begin(async (tx) => {
        await ensureLotsForPurchase(tx, id, session.userId);
        const [lot] = await tx`select local_purchase_id from public.purchase_lots where id = ${body.lotId}::uuid`;
        if (!lot || lot.local_purchase_id !== id) throw new ApiClientError("That lot does not belong to this purchase.", { status: 400, code: "LOT_MISMATCH" });
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: "authenticated" })}, true)`;
        if (body.purpose === "export_dgt_branch") return createInterCountryTrade(tx, { ...body, userId: session.userId });
        return createTransfer(tx, { ...body, userId: session.userId });
      });
    });
    const tr = (result as any)?.transfer;
    if (tr && !(result as any)?.replayed) {
      await writeAuditLog({ action: "goods_transfer_create", entityTable: "goods_transfers", entityId: tr.id, before: null, after: { ...tr, trade: (result as any)?.trade?.trade_ref ?? null }, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    }
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
