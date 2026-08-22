import { buildVerifiedTranslationSet } from "@/lib/i18n/verified-record-translations";
import { purchaseOrderTranslationFields } from "@/lib/i18n/purchase-order-translations";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

function money(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function saveTranslations(tx: any, input: {
  recordId: string;
  originalLanguage: any;
  fields: Array<{ fieldName: string; value: string | null | undefined; mode?: "translate" | "transliterate"; translations?: Record<string, string> }>;
  actorId?: string | null;
  source?: "auto" | "manual" | "imported";
}) {
  for (const field of input.fields.filter((item) => typeof item.value === "string" && String(item.value).trim())) {
    const originalText = String(field.value).trim();
    const verified = await buildVerifiedTranslationSet({
      value: originalText,
      originalLanguage: input.originalLanguage,
      mode: field.mode,
      supplied: field.translations as any
    });

    await tx`
      select upsert_record_translation(
        ${"purchase_orders"},
        ${input.recordId}::uuid,
        ${field.fieldName},
        ${originalText},
        ${input.originalLanguage},
        ${verified.translations.en ?? null},
        ${verified.translations.ur ?? null},
        ${verified.translations.ar ?? null},
        ${verified.translations.fa ?? null},
        ${verified.translations.ps ?? null},
        ${tx.json(verified.translations)},
        ${input.source ?? "auto"},
        ${verified.status},
        ${verified.engine},
        ${input.source === "manual" ? input.actorId ?? null : null}
      )
    `;
  }
}

export async function createPurchaseOrderViaLocalPg(input: {
  session: Pick<ErpSession, "userId" | "fullName" | "email" | "preferredLanguage">;
  body: any;
  effective: { countryId: string | null; countryBranchId: string | null; cityBranchId: string | null };
}) {
  const { session, body, effective } = input;
  return await withLocalPg(async (sql) => {
    return await sql.begin(async (tx) => {
      await tx`
        select set_config(
          'request.jwt.claims',
          ${JSON.stringify({ sub: session.userId, role: "authenticated" })},
          true
        );
      `;

      const form = body.formData?.form || {};
      const purchaseAccountId = form.purchaseAccountId || form.purchaseAccountNo;
      const salesAccountId = form.salesAccountId || form.salesAccountNo;

      const lookupScope = async (term: string | null | undefined, table: "enterprise_accounts" | "ledgers") => {
        const clean = String(term || "").trim();
        if (!clean) return null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);
        if (table === "enterprise_accounts") {
          const rows = isUuid
            ? await tx`select id, code, name, country_id from enterprise_accounts where id = ${clean}::uuid and deleted_at is null limit 1`
            : [];
          const byId = rows[0] ?? null;
          const byCode = byId ? null : (await tx`select id, code, name, country_id from enterprise_accounts where code = ${clean} and deleted_at is null limit 1`)[0] ?? null;
          const row = byId ?? byCode;
          if (row && effective.countryId && row.country_id && row.country_id !== effective.countryId) {
            throw new Error(`Cross-country violation: Account '${row.name}' (${row.code}) belongs to a different country than the transaction target country.`);
          }
          return row;
        }
        const rows = isUuid
          ? await tx`select id, code, name, country_id from ledgers where id = ${clean}::uuid and deleted_at is null limit 1`
          : [];
        const byId = rows[0] ?? null;
        const byCode = byId ? null : (await tx`select id, code, name, country_id from ledgers where code = ${clean} and deleted_at is null limit 1`)[0] ?? null;
        const row = byId ?? byCode;
        if (row && effective.countryId && row.country_id && row.country_id !== effective.countryId) {
          throw new Error(`Cross-country violation: Ledger '${row.name}' (${row.code}) belongs to a different country than the transaction target country.`);
        }
        return row;
      };

      if (purchaseAccountId) {
        await lookupScope(purchaseAccountId, "enterprise_accounts");
      }
      if (salesAccountId) {
        await lookupScope(salesAccountId, "enterprise_accounts");
      }

      let countryPrefix = "PK";
      if (effective.countryId) {
        const countryRows = await tx`select iso2 from countries where id = ${effective.countryId}::uuid limit 1`;
        if (countryRows[0]?.iso2) countryPrefix = String(countryRows[0].iso2).toUpperCase();
      }

      let branchPrefix = "QTA";
      if (effective.cityBranchId) {
        const cityRows = await tx`select code from city_branches where id = ${effective.cityBranchId}::uuid limit 1`;
        if (cityRows[0]?.code) {
          const parts = String(cityRows[0].code).split("-");
          branchPrefix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : String(cityRows[0].code).toUpperCase();
        }
      }

      const branchCountRows = effective.cityBranchId ? await tx`select count(*)::int as count from purchase_orders where city_branch_id = ${effective.cityBranchId}::uuid` : [];
      const countryCountRows = effective.countryId ? await tx`select count(*)::int as count from purchase_orders where country_id = ${effective.countryId}::uuid` : [];
      const totalCountRows = await tx`select count(*)::int as count from purchase_orders`;

      const branchSeq = (branchCountRows[0]?.count ?? 0) + 1;
      const countrySeq = (countryCountRows[0]?.count ?? 0) + 1;
      const totalSeq = (totalCountRows[0]?.count ?? 0) + 1;

      const branchTransactionSerialNumber = effective.cityBranchId ? `${countryPrefix}-${branchPrefix}-${String(branchSeq).padStart(4, "0")}` : null;
      const countryTransactionSerialNumber = effective.countryId ? `${countryPrefix}-${String(countrySeq).padStart(6, "0")}` : null;
      const superAdminSerialNumber = String(totalSeq).padStart(8, "0");

      const purchaseOrderNo = !body.purchaseOrderNo || body.purchaseOrderNo === "AUTO"
        ? branchTransactionSerialNumber || `PO-${Date.now()}`
        : String(body.purchaseOrderNo).trim();

      const orderTotal = money(body.orderTotal);
      const advanceAmount = money((body as any).advanceAmount ?? form.advanceAmount ?? 0);
      const remainingDue = Math.max(0, orderTotal - advanceAmount);
      let paymentStatus = body.paymentStatus || "unpaid";
      if (advanceAmount > 0 && advanceAmount < orderTotal) paymentStatus = "partially_paid";
      else if (advanceAmount >= orderTotal && orderTotal > 0) paymentStatus = "paid";

      const purchaseCurrency = body.purchaseCurrency || "USD";
      const paymentCurrency = body.paymentCurrency || purchaseCurrency;

      const payload = {
        country_id: effective.countryId,
        country_branch_id: effective.countryBranchId,
        city_branch_id: effective.cityBranchId,
        // Country-to-Country Purchase: optional destination scope, distinct from the
        // purchasing scope above. Left null for a plain same-country purchase.
        dest_country_id: body.destCountryId ?? null,
        dest_country_branch_id: body.destCountryBranchId ?? null,
        dest_city_branch_id: body.destCityBranchId ?? null,
        purchase_order_no: purchaseOrderNo,
        purchase_contract_no: body.purchaseContractNo?.trim() || null,
        supplier_company_id: body.supplierCompanyId ?? null,
        purchase_currency: purchaseCurrency,
        payment_currency: paymentCurrency,
        currency_code: purchaseCurrency,
        exchange_rate: body.exchangeRate,
        order_total: body.orderTotal,
        total_goods_original: body.totalGoodsOriginal ?? 0,
        total_goods_local: body.totalGoodsLocal ?? 0,
        total_goods_usd: body.totalGoodsUsd ?? 0,
        total_expenses_original: body.totalExpensesOriginal ?? 0,
        total_expenses_local: body.totalExpensesLocal ?? 0,
        total_expenses_usd: body.totalExpensesUsd ?? 0,
        landed_cost_original: body.landedCostOriginal ?? 0,
        landed_cost_local: body.landedCostLocal ?? 0,
        landed_cost_usd: body.landedCostUsd ?? 0,
        form_data: {
          ...(body.formData || {}),
          form: {
            ...(body.formData?.form || {}),
            billNo: branchTransactionSerialNumber || body.formData?.form?.billNo || null
          }
        },
        payment_status: paymentStatus,
        ledger_posting_status: body.ledgerPostingStatus || "unposted",
        advance_paid: advanceAmount,
        remaining_due: remainingDue,
        super_admin_serial_number: superAdminSerialNumber,
        country_transaction_serial_number: countryTransactionSerialNumber,
        branch_transaction_serial_number: branchTransactionSerialNumber
      };

      const insertedRows = await tx`insert into purchase_orders ${tx(payload as any)} returning id, purchase_order_no`;
      const inserted = insertedRows[0];
      if (!inserted?.id) throw new Error("Purchase order insert failed.");

      if (Array.isArray(body.items) && body.items.length > 0) {
        const itemsPayload = body.items.map((it: any) => ({
          purchase_order_id: inserted.id,
          product_id: it.productId || null,
          goods_name: it.goodsName || "Unknown",
          hs_code: it.hsCode || null,
          size: it.size || null,
          brand: it.brand || null,
          origin: it.origin || null,
          quantity: it.quantity || 0,
          unit_name: it.unitName || "pcs",
          unit_weight: it.unitWeight || 0,
          gross_weight: it.grossWeight || 0,
          net_weight: it.netWeight || 0,
          rate_original: it.rateOriginal || 0,
          rate_local: it.rateLocal || 0,
          rate_usd: it.rateUsd || 0,
          total_original: it.totalOriginal || 0,
          total_local: it.totalLocal || 0,
          total_usd: it.totalUsd || 0
        }));
        await tx`insert into purchase_order_items ${tx(itemsPayload as any)}`;
      }

      if (Array.isArray(body.expenses) && body.expenses.length > 0) {
        const expPayload = body.expenses.map((ex: any) => ({
          purchase_order_id: inserted.id,
          expense_type: ex.expenseType,
          ledger_id: ex.ledgerId || null,
          description: ex.description || null,
          exchange_rate: ex.exchangeRate || 1
        }));
        await tx`insert into purchase_order_expenses ${tx(expPayload as any)}`;
      }

      const translationFields = purchaseOrderTranslationFields(body.formData, body.items).map((field) => ({
        ...field,
        translations: (body.translations as any)?.[field.fieldName]
      }));
      await saveTranslations(tx, {
        recordId: inserted.id,
        originalLanguage: body.originalLanguage,
        fields: translationFields,
        actorId: session.userId,
        source: "auto"
      });

      return {
        purchaseOrderId: inserted.id,
        purchaseOrderNo: inserted.purchase_order_no,
        systemBillNumber: purchaseOrderNo,
        branchTransactionSerialNumber,
        countryTransactionSerialNumber,
        superAdminSerialNumber,
        paymentStatus,
        ledgerPostingStatus: payload.ledger_posting_status
      };
    });
  });
}
