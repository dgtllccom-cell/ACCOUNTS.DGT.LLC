import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { getDocumentAiProvider } from "@/lib/document-intelligence/providers";
import { extractAccountTable } from "@/lib/document-intelligence/account-table-extractor";
import { withLocalPg } from "@/lib/db/local-postgres";
import { checkRateLimit, sweepRateLimiter } from "@/lib/document-intelligence/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/**
 * POST /api/erp/document-intelligence/extract
 *
 * Stateless "extract for review" — used by the New Account bulk-import screen.
 * Runs OCR + table parsing on an uploaded chart-of-accounts / khaata document and
 * returns ONE ROW PER ACCOUNT, each flagged valid / duplicate / needs-review.
 * NOTHING is written. The user reviews + edits, then confirms via bulk-create.
 */

const KIND_MAP: Record<string, "asset" | "liability" | "equity" | "income" | "expense"> = {
  asset: "asset", liability: "liability", capital: "equity", equity: "equity",
  income: "income", revenue: "income", expense: "expense", receivable: "asset", payable: "liability",
};

const metaSchema = z.object({
  targetModule: z.string().trim().max(60).optional(),
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().optional(),
  cityBranchId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return apiError("VALIDATION", "Upload must be multipart/form-data with a 'file' part.", 400);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("VALIDATION", "Missing 'file' part.", 400);

    const rawMeta: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) if (k !== "file" && typeof v === "string" && v !== "") rawMeta[k] = v;
    const meta = metaSchema.parse(rawMeta);

    const { session } = await guardIntake("write", "business");

    sweepRateLimiter();
    const rl = checkRateLimit("upload", session.userId);
    if (!rl.ok) return apiError("RATE_LIMITED", `Too many uploads — retry in ${rl.retryAfterSec}s.`, 429);

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "document";
    const mimeType = file.type || "application/octet-stream";
    const lowerName = filename.toLowerCase();

    // 1. Get the document text.
    //    - plain-text / CSV / TSV  → decode directly (NEVER send to OCR — tesseract
    //      throws an uncaught "pix not read" on a text buffer)
    //    - PDF / image             → the local OCR / text-layer provider
    let fullText = "";
    let pageCount = 1;
    const isTextLike =
      /^text\//i.test(mimeType) ||
      /csv|tab-separated|plain/i.test(mimeType) ||
      /\.(csv|tsv|txt)$/i.test(lowerName);

    if (isTextLike) {
      fullText = buffer.toString("utf8");
    } else {
      const provider = getDocumentAiProvider();
      try {
        const ingest = await provider.ingest({ buffer, mimeType, filename });
        fullText = ingest.fullText || "";
        pageCount = ingest.pageCount || 1;
      } catch (e) {
        // last-ditch: maybe it really was text with a wrong mime
        const asText = buffer.toString("utf8");
        if (/[,\t|]/.test(asText) && /[A-Za-z]/.test(asText) && !/�{4,}/.test(asText)) {
          fullText = asText;
        } else {
          return apiError("EXTRACTION_FAILED", `Could not read the document: ${(e as Error).message}`, 422);
        }
      }
    }

    // 2. parse the account table → one row per account
    const table = extractAccountTable(fullText);

    // 3. duplicate check against existing accounts in the chosen scope
    const codes = table.rows.map((r) => (r.accountCode || "").trim().toLowerCase()).filter(Boolean);
    const names = table.rows.map((r) => (r.accountName || "").trim().toLowerCase()).filter(Boolean);
    let existingCodes = new Set<string>();
    let existingNames = new Set<string>();
    if (codes.length || names.length) {
      try {
        const rows = await withLocalPg(async (sql) => {
          const scopeCond = meta.cityBranchId
            ? sql`city_branch_id = ${meta.cityBranchId}`
            : meta.countryBranchId
              ? sql`country_branch_id = ${meta.countryBranchId}`
              : meta.countryId
                ? sql`country_id = ${meta.countryId}`
                : sql`true`;
          return sql`
            SELECT lower(code) AS code, lower(name) AS name
            FROM public.enterprise_accounts
            WHERE deleted_at IS NULL AND (${scopeCond})
              AND (lower(code) = ANY(${codes}) OR lower(name) = ANY(${names}))`;
        });
        existingCodes = new Set((rows ?? []).map((r: any) => r.code).filter(Boolean));
        existingNames = new Set((rows ?? []).map((r: any) => r.name).filter(Boolean));
      } catch {
        // enterprise_accounts unavailable locally → skip dup check, flag in warnings
        table.warnings.push("Could not check existing accounts for duplicates — verify manually before creating.");
      }
    }

    // 4. shape the review payload
    const extracted = table.rows.map((r) => {
      const codeLc = (r.accountCode || "").trim().toLowerCase();
      const nameLc = (r.accountName || "").trim().toLowerCase();
      const isDuplicate = (codeLc && existingCodes.has(codeLc)) || (nameLc && existingNames.has(nameLc));
      const missingRequired: string[] = [];
      if (!r.accountName) missingRequired.push("accountName");
      if (!r.category) missingRequired.push("category");
      const status: "valid" | "duplicate" | "invalid" =
        isDuplicate ? "duplicate" : missingRequired.length ? "invalid" : "valid";
      return {
        rowIndex: r.rowIndex,
        account_code: r.accountCode,
        account_name: r.accountName,
        category: r.category,
        kind: r.category ? KIND_MAP[r.category.toLowerCase()] ?? null : null,
        branch: r.branch,
        company_name: r.companyName,
        business_name: r.businessName,
        city: r.city,
        address: r.address,
        mobile: r.mobile,
        whatsapp: r.whatsapp,
        phone: r.phone,
        email: r.email,
        currency: "USD",
        status,
        message:
          status === "duplicate" ? "An account with this code or name already exists in the selected scope."
          : status === "invalid" ? `Needs review: missing ${missingRequired.join(", ")}.`
          : r.uncertainFields.length ? `Auto-mapped fields — please verify: ${r.uncertainFields.join(", ")}.`
          : null,
        uncertainFields: r.uncertainFields,
        sourceLine: r.sourceLine,
      };
    });

    const counts = {
      total: extracted.length,
      valid: extracted.filter((e) => e.status === "valid").length,
      duplicate: extracted.filter((e) => e.status === "duplicate").length,
      invalid: extracted.filter((e) => e.status === "invalid").length,
    };

    return apiOk({
      filename,
      pageCount,
      detectedFormat: table.detectedFormat,
      headerFound: table.headerFound,
      linesScanned: table.totalLinesScanned,
      warnings: table.warnings,
      counts,
      extracted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
