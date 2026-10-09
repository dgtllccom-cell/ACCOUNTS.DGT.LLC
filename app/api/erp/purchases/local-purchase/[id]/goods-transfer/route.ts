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

async function loadPurchaseScope(sql: any, id: string) {
  const [p] = await sql`select id, status, country_id, country_branch_id, city_branch_id from public.local_purchases where id = ${id}::uuid and deleted_at is null`;
  if (!p) throw new ApiClientError("Purchase not found.", { status: 404, code: "PURCHASE_NOT_FOUND" });
  return p;
}

/** Goods Transfer Journal for one purchase (creates the permanent lots on first open of an already-posted bill). */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    uuid.parse(id);
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
