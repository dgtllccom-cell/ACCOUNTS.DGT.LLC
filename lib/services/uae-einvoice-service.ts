/* eslint-disable @typescript-eslint/no-explicit-any */
import { withLocalPg } from "@/lib/db/local-postgres";
import { getAspAdapter } from "@/lib/services/asp/registry";
import type { AspContext } from "@/lib/services/asp/asp-adapter";
import { mapToPintAe, validatePintAe, type ErpEInvoiceInput } from "@/lib/services/einvoice/pint-ae-mapper";

const VAT_CAT: Record<string, ErpEInvoiceInput["lines"][number]["vatCategory"]> = {
  standard: "S",
  zero_rated: "Z",
  exempt: "E",
  out_of_scope: "O",
  reverse_charge: "RC",
  deemed_supply: "S",
};

/** Terminal submitted statuses that must never be re-submitted (dedup). */
const LOCKED = new Set(["submitted", "processing", "delivered", "completed"]);

export class UaeEInvoiceService {
  private async loadContext(sql: any, eInvoiceId: string): Promise<{ inv: any; ctx: AspContext } | null> {
    const [inv] = await sql`
      SELECT i.*, e.trn AS tax_entity_trn, e.legal_name AS seller_name, e.address AS seller_address
      FROM public.uae_e_invoices i
      JOIN public.uae_tax_entities e ON e.id = i.tax_entity_id
      WHERE i.id = ${eInvoiceId} AND i.deleted_at IS NULL
    `;
    if (!inv) return null;
    const [cred] = await sql`
      SELECT provider, config, secret_ref FROM public.uae_asp_credentials
      WHERE tax_entity_id = ${inv.tax_entity_id} AND is_active = TRUE AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1
    `;
    const ctx: AspContext = {
      provider: cred?.provider ?? "mock",
      mode: (cred?.config?.mode as AspContext["mode"]) ?? "mock",
      endpoint: cred?.config?.endpoint,
      secretRef: cred?.secret_ref ?? undefined,
      taxEntityTrn: inv.tax_entity_trn,
    };
    return { inv, ctx };
  }

  private buildPayload(inv: any, taxLines: any[]): Record<string, unknown> {
    const erpInput: ErpEInvoiceInput = {
      invoiceNumber: inv.invoice_number || inv.source_reference_no || inv.id,
      documentType: inv.document_type,
      issueDate: (inv.issue_date ?? new Date().toISOString().slice(0, 10)).toString().slice(0, 10),
      currency: inv.currency || "AED",
      seller: { name: inv.seller_name, trn: inv.tax_entity_trn, address: inv.seller_address, country: "AE" },
      buyer: { name: inv.buyer_name, trn: inv.buyer_trn, country: "AE" },
      lines: (taxLines.length ? taxLines : [null]).map((tl, i) =>
        tl
          ? {
              id: i + 1,
              description: tl.description || tl.account_name || "Item",
              quantity: 1,
              unitPrice: Number(tl.aed_taxable_amount) || 0,
              lineNet: Number(tl.aed_taxable_amount) || 0,
              vatCategory: VAT_CAT[tl.tax_category] ?? "S",
              vatRate: Number(tl.vat_rate) || 5,
              vatAmount: Number(tl.aed_vat_amount) || 0,
            }
          : {
              id: 1,
              description: "Invoice total",
              quantity: 1,
              unitPrice: Number(inv.total_excl_vat) || 0,
              lineNet: Number(inv.total_excl_vat) || 0,
              vatCategory: "S" as const,
              vatRate: 5,
              vatAmount: Number(inv.total_vat) || 0,
            },
      ),
      totals: {
        netAmount: Number(inv.total_excl_vat) || 0,
        vatAmount: Number(inv.total_vat) || 0,
        grossAmount: Number(inv.total_incl_vat) || 0,
      },
      relatedInvoiceNumber:
        inv.document_type === "tax_credit_note" && inv.related_e_invoice_id ? inv.source_reference_no : undefined,
    };
    return mapToPintAe(erpInput);
  }

  async validate(eInvoiceId: string): Promise<{ valid: boolean; errors: any[] }> {
    const res = await withLocalPg(async (sql) => {
      const loaded = await this.loadContext(sql, eInvoiceId);
      if (!loaded) throw new Error("e-invoice not found");
      const taxLines = await sql`
        SELECT * FROM public.uae_tax_lines
        WHERE source_module = ${loaded.inv.source_module} AND source_id = ${loaded.inv.source_id} AND deleted_at IS NULL
      `;
      const payload = this.buildPayload(loaded.inv, taxLines);
      const errors = validatePintAe(payload);
      await sql`
        UPDATE public.uae_e_invoices
        SET pint_ae_payload = ${sql.json(payload as any)},
            validation_errors = ${sql.json(errors as any)},
            status = ${errors.length ? "draft" : "validated"},
            updated_at = NOW()
        WHERE id = ${eInvoiceId}
      `;
      return { valid: errors.length === 0, errors };
    });
    return res ?? { valid: false, errors: [{ code: "DB", message: "Database not configured" }] };
  }

  async submit(eInvoiceId: string, actor: string): Promise<{ status: string; aspReference?: string; message?: string }> {
    const res = await withLocalPg(async (sql) => {
      const loaded = await this.loadContext(sql, eInvoiceId);
      if (!loaded) throw new Error("e-invoice not found");
      const { inv, ctx } = loaded;

      if (LOCKED.has(inv.status)) {
        return { status: inv.status, aspReference: inv.asp_reference, message: "Already submitted — duplicate submission blocked" };
      }

      const taxLines = await sql`
        SELECT * FROM public.uae_tax_lines
        WHERE source_module = ${inv.source_module} AND source_id = ${inv.source_id} AND deleted_at IS NULL
      `;
      const payload = inv.pint_ae_payload ?? this.buildPayload(inv, taxLines);
      const adapter = getAspAdapter(ctx.provider);

      const v = await adapter.validate(payload, ctx);
      if (!v.valid) {
        await sql`
          UPDATE public.uae_e_invoices
          SET status = 'draft', validation_errors = ${sql.json(v.errors as any)}, updated_at = NOW()
          WHERE id = ${eInvoiceId}
        `;
        return { status: "draft", message: `Validation failed: ${v.errors.length} error(s)` };
      }

      try {
        const r = await adapter.submit(payload, inv.document_type, ctx);
        await sql`
          UPDATE public.uae_e_invoices
          SET status = ${r.accepted ? r.status : "rejected"},
              asp_provider = ${ctx.provider},
              asp_reference = ${r.aspReference ?? null},
              asp_response = ${sql.json((r.raw ?? { message: r.message }) as any)},
              last_error = ${r.accepted ? null : r.message ?? null},
              pint_ae_payload = ${sql.json(payload as any)},
              submitted_by = ${actor}::uuid,
              submitted_at = NOW(),
              updated_at = NOW()
          WHERE id = ${eInvoiceId}
        `;
        return { status: r.accepted ? r.status : "rejected", aspReference: r.aspReference, message: r.message };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sql`
          UPDATE public.uae_e_invoices
          SET status = 'retry_required', last_error = ${msg}, retry_count = retry_count + 1, updated_at = NOW()
          WHERE id = ${eInvoiceId}
        `;
        return { status: "retry_required", message: msg };
      }
    });
    return res ?? { status: "error", message: "Database not configured" };
  }

  async refreshStatus(eInvoiceId: string): Promise<{ status: string; message?: string }> {
    const res = await withLocalPg(async (sql) => {
      const loaded = await this.loadContext(sql, eInvoiceId);
      if (!loaded || !loaded.inv.asp_reference) return { status: loaded?.inv.status ?? "draft", message: "No ASP reference" };
      const adapter = getAspAdapter(loaded.ctx.provider);
      const r = await adapter.getStatus(loaded.inv.asp_reference, loaded.ctx);
      await sql`
        UPDATE public.uae_e_invoices SET status = ${r.status}, updated_at = NOW() WHERE id = ${eInvoiceId}
      `;
      return { status: r.status, message: r.message };
    });
    return res ?? { status: "error", message: "Database not configured" };
  }
}

export const uaeEInvoiceService = new UaeEInvoiceService();
