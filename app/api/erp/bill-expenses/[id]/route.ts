import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/bill-expenses/[id]
 * Returns the register row + its expense lines + a read-only projection of the
 * ORIGINAL source bill (so the UI can auto-fill — the user never re-enters bill
 * data). Scope is enforced: the register row must fall inside the caller's
 * country/branch scope.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const scope = resolveReportScope(session);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const payload = await withLocalPg(async (sql) => {
      const [be] = await sql`
        select be.*, c.name as country_name, c.iso2 as country_code,
               cb.name as country_branch_name, cib.city_name as city_branch_name, cib.name as city_branch_alt_name
        from public.bill_expenses be
        left join public.countries c on c.id = be.country_id
        left join public.country_branches cb on cb.id = be.country_branch_id
        left join public.city_branches cib on cib.id = be.city_branch_id
        where be.id = ${id}::uuid and be.deleted_at is null
        limit 1
      `;
      if (!be) return { notFound: true } as const;

      // Server-side scope enforcement — never trust the id alone.
      if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
        return { forbidden: true } as const;
      }
      if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
        return { forbidden: true } as const;
      }

      const lines = await sql`
        select id, row_serial, expense_type, details, currency, amount, exchange_rate,
               local_amount, tax_pct, tax_amount, grand_amount,
               expense_account_id, counter_account_id, roznamcha_entry_id,
               ledger_posting_batch_id, posting_status, posted_at, created_at, updated_at
        from public.bill_expense_lines
        where bill_expense_id = ${id}::uuid and deleted_at is null
        order by row_serial asc, created_at asc
      `;

      // Read-only source-bill projection for auto-fill.
      let sourceBill: any = null;
      if (be.source_table === "purchase_orders") {
        const [po] = await sql`
          select purchase_order_no, purchase_contract_no, currency_code, purchase_currency,
                 order_total, landed_cost_original, exchange_rate, ledger_posting_status, status,
                 form_data->'form'->>'supplierName' as supplier_name,
                 form_data->'form'->>'purchaseAccountName' as purchase_account_name,
                 form_data->'form'->>'goodsName' as goods_name,
                 form_data->'form'->>'manualBillNumber' as manual_bill_number
          from public.purchase_orders where id = ${be.source_id}::uuid limit 1`;
        sourceBill = po ?? null;
      } else if (be.source_table === "local_purchases") {
        const [lp] = await sql`
          select manual_bill_no, journal_serial_no, supplier_name, goods_name, purchase_account_no,
                 purchase_currency, local_currency, exchange_rate, final_cost, purchase_cost, status
          from public.local_purchases where id = ${be.source_id}::uuid limit 1`;
        sourceBill = lp ?? null;
      } else if (be.source_table === "sales_orders") {
        const [so] = await sql`
          select sales_order_no, sales_contract_no, customer_name, account_number, product_summary,
                 currency_code, original_currency_code, exchange_rate, order_total, base_currency_amount,
                 sales_status, ledger_posting_status
          from public.sales_orders where id = ${be.source_id}::uuid limit 1`;
        sourceBill = so ?? null;
      } else if (be.source_table === "shipping_bl_records") {
        const [bl] = await sql`
          select bl_number, container_number, vessel_name, voyage_number, shipping_line_name,
                 loading_port, discharge_port, etd, eta, account_number, debit, credit,
                 currency_code, shipment_status
          from public.shipping_bl_records where id = ${be.source_id}::uuid limit 1`;
        sourceBill = bl ?? null;
      } else if (be.source_table === "clearing_payment_bills") {
        const [cp] = await sql`
          select bill_no, gd_number, bl_number, order_no, agent_name, port_name,
                 customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges,
                 other_charges, total_amount, currency_code, payment_status, payment_method, status
          from public.clearing_payment_bills where id = ${be.source_id}::uuid limit 1`;
        sourceBill = cp ?? null;
      }

      let localizedBe: any[] = [be];
      try {
        localizedBe = await localizeRecordFields<any>(localizedBe, "bill_expenses", ["party_name"], lang);
        localizedBe = await localizeJoinedNames(localizedBe, lang, [
          { idField: "country_id", nameField: "country_name", table: "countries" },
          { idField: "country_branch_id", nameField: "country_branch_name", table: "country_branches" },
          { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches" }
        ]);
      } catch {
        localizedBe = [be];
      }
      const beLoc = localizedBe[0] ?? be;

      if (sourceBill) {
        try {
          if (be.source_table === "local_purchases") {
            [sourceBill] = await localizeRecordFields<any>([sourceBill], "local_purchases", ["supplier_name", "goods_name"], lang);
          } else if (be.source_table === "sales_orders") {
            [sourceBill] = await localizeRecordFields<any>([sourceBill], "sales_orders", ["customer_name"], lang);
          } else if (be.source_table === "shipping_bl_records") {
            [sourceBill] = await localizeRecordFields<any>([sourceBill], "shipping_bl_records", ["vessel_name", "shipping_line_name"], lang);
          } else if (be.source_table === "clearing_payment_bills") {
            [sourceBill] = await localizeRecordFields<any>([sourceBill], "clearing_payment_bills", ["agent_name", "port_name"], lang);
          }
        } catch {
          // keep the original, unlocalized sourceBill on failure
        }
      }

      return {
        billExpense: {
          id: be.id,
          sourceModule: be.source_module,
          sourceId: be.source_id,
          sourceTable: be.source_table,
          billNo: be.bill_no,
          manualBillNo: be.manual_bill_no,
          billDate: be.bill_date,
          transactionDate: be.transaction_date,
          countryId: be.country_id,
          countryName: beLoc.country_name,
          countryBranchId: be.country_branch_id,
          countryBranchName: beLoc.country_branch_name,
          cityBranchId: be.city_branch_id,
          cityBranchName: beLoc.city_branch_name || be.city_branch_alt_name,
          branchLabel: beLoc.city_branch_name || beLoc.country_branch_name || beLoc.country_name || "—",
          partyAccountNo: be.party_account_no,
          partyName: beLoc.party_name,
          currency: be.currency,
          originalBillAmount: Number(be.original_bill_amount || 0),
          expenseTotal: Number(be.expense_total || 0),
          expenseCount: Number(be.expense_count || 0),
          eligibility: be.eligibility,
          sourceStatus: be.source_status,
          status: be.status,
          createdAt: be.created_at,
          updatedAt: be.updated_at
        },
        lines: (lines ?? []).map((l: any) => ({
          id: l.id,
          rowSerial: l.row_serial,
          expenseType: l.expense_type,
          details: l.details,
          currency: l.currency,
          amount: Number(l.amount || 0),
          exchangeRate: Number(l.exchange_rate || 1),
          localAmount: Number(l.local_amount || 0),
          taxPct: Number(l.tax_pct || 0),
          taxAmount: Number(l.tax_amount || 0),
          grandAmount: Number(l.grand_amount || 0),
          expenseAccountId: l.expense_account_id,
          roznamchaEntryId: l.roznamcha_entry_id,
          ledgerPostingBatchId: l.ledger_posting_batch_id,
          postingStatus: l.posting_status,
          postedAt: l.posted_at,
          createdAt: l.created_at
        })),
        sourceBill
      };
    });

    if (!payload) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });
    if ("notFound" in payload) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });
    if ("forbidden" in payload) throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });

    return apiOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
