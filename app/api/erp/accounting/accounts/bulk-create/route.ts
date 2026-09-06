import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { auditApiAction } from "@/lib/api/audit";
import { POST as createSingleAccount } from "@/app/api/erp/accounting/accounts/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/erp/accounting/accounts/bulk-create
 *
 * Create MANY chart-of-accounts rows from a reviewed import (New Account -> Scan /
 * Upload Document). The user has already reviewed + edited every row on screen.
 *
 * Each row is created through the SAME single-account endpoint the manual form
 * uses (POST /api/erp/accounting/accounts) - so serial allocation, code
 * prefixing, scope authorisation, validation, RLS and audit are identical and
 * never duplicated here. A row whose code already exists in scope is SKIPPED
 * (counted, not surfaced as an error). Re-running the same import creates no
 * duplicates. Opening balance is always 0 - no journal entry is posted.
 */

const KINDS = ["asset", "liability", "equity", "income", "expense"] as const;

const rowSchema = z.object({
  code: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(200),
  kind: z.enum(KINDS).default("asset"),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).default("USD"),
});

const bodySchema = z.object({
  scope: z.enum(["super_admin", "country", "main_branch", "city_branch"]),
  countryId: z.string().uuid().optional().nullable(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
  accounts: z.array(rowSchema).min(1).max(500),
});

function isDuplicateError(msg: string): boolean {
  return /duplicate|already exist|unique|23505/i.test(msg);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = bodySchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "accounts",
      action: "create",
      countryId: body.countryId ?? undefined,
      countryBranchId: body.countryBranchId ?? undefined,
      cityBranchId: body.cityBranchId ?? undefined,
    });

    const scopeOk =
      (body.scope === "super_admin" && !body.countryId && !body.countryBranchId && !body.cityBranchId) ||
      (body.scope === "country" && !!body.countryId && !body.countryBranchId && !body.cityBranchId) ||
      (body.scope === "main_branch" && !!body.countryBranchId && !body.cityBranchId) ||
      (body.scope === "city_branch" && !!body.cityBranchId);
    if (!scopeOk) return apiError("VALIDATION", "The selected scope does not match the country / branch fields.", 400);

    const created: Array<{ code: string; name: string; issuedCode?: string }> = [];
    const skipped: Array<{ code: string; name: string; reason: string }> = [];
    const failed: Array<{ code: string; name: string; error: string }> = [];
    const seen = new Set<string>();

    for (const acc of body.accounts) {
      const key = acc.code.toLowerCase() + "|" + acc.name.toLowerCase();
      if (seen.has(key)) { skipped.push({ code: acc.code, name: acc.name, reason: "duplicate row in this import" }); continue; }
      seen.add(key);

      const singleBody = {
        scope: body.scope,
        countryId: body.countryId ?? undefined,
        countryBranchId: body.countryBranchId ?? undefined,
        cityBranchId: body.cityBranchId ?? undefined,
        code: acc.code,
        name: acc.name,
        kind: acc.kind,
        currency: acc.currency,
        openingBalance: 0,
        isControlAccount: false,
      };

      try {
        const subReq = new NextRequest("http://internal/api/erp/accounting/accounts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(singleBody),
        });
        const res = await createSingleAccount(subReq);
        const json: any = await res.json().catch(() => ({}));
        if (res.ok) {
          const acct = json?.data?.account ?? json?.data ?? {};
          created.push({ code: acc.code, name: acc.name, issuedCode: acct.code ?? acct.issuedCode });
        } else {
          const msg = json?.error?.message || json?.error || ("HTTP " + res.status);
          if (isDuplicateError(String(msg))) skipped.push({ code: acc.code, name: acc.name, reason: "already exists in this scope" });
          else failed.push({ code: acc.code, name: acc.name, error: String(msg) });
        }
      } catch (e) {
        const msg = (e as Error).message;
        if (isDuplicateError(msg)) skipped.push({ code: acc.code, name: acc.name, reason: "already exists in this scope" });
        else failed.push({ code: acc.code, name: acc.name, error: msg });
      }
    }

    await auditApiAction(request, {
      action: "accounts.bulk_create",
      entityTable: "enterprise_accounts",
      after: {
        scope: body.scope,
        countryId: body.countryId,
        countryBranchId: body.countryBranchId,
        cityBranchId: body.cityBranchId,
        requested: body.accounts.length,
        created: created.length,
        skipped: skipped.length,
        failed: failed.length,
      },
    }).catch(() => {});

    return apiOk({
      requested: body.accounts.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      created,
      skipped,
      failed,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
