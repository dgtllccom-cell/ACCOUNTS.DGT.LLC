import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";
import { checkRateLimit, sweepRateLimiter } from "@/lib/document-intelligence/rate-limit";
import { EMPTY_ACCOUNT_SELECTION } from "@/lib/document-intelligence/intake-modules";
import { EMPTY_EXCHANGE, EMPTY_FORM, type ReviewState } from "@/lib/document-intelligence/review-state";

const nullableNum = z.number().finite().nullable().optional().transform((v) => v ?? null);
const accountId = z.string().max(64).nullish().transform((v) => v ?? "");
const reviewSchema = z.object({
  moduleId: z.string().trim().min(1).max(60),
  form: z.record(z.string().max(4000).nullable()).transform((f) => ({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v ?? ""])) })),
  party: z.object({
    id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    kind: z.enum(["customer", "company"]).nullable().optional().transform((v) => v ?? null),
    name: z.string().max(300).default(""),
    documentName: z.string().max(300).default(""),
  }),
  accounts: z.object({
    supplierAccountId: accountId, purchaseAccountId: accountId, customerAccountId: accountId, salesAccountId: accountId,
    debitAccountId: accountId, creditAccountId: accountId, bankAccountId: accountId,
  }).transform((a) => ({ ...EMPTY_ACCOUNT_SELECTION, ...a })),
  items: z.array(z.object({
    description: z.string().max(1000).default(""), hsCode: z.string().max(40).default(""), quantity: nullableNum, unit: z.string().max(30).default(""),
    unitPrice: nullableNum, amount: nullableNum, grossWeight: nullableNum, tareWeight: nullableNum, netWeight: nullableNum,
    lotNo: z.string().max(80).default(""), variety: z.string().max(120).default(""), quality: z.string().max(200).default(""),
    sourcePage: z.number().int().nullable().optional().transform((v) => v ?? null),
  })).max(200),
  exchange: z.object({
    originalAmount: nullableNum, originalCurrency: z.string().max(3).default(""), finalCurrency: z.string().max(3).default(""),
    rate: nullableNum, rateDate: z.string().max(10).nullable().optional().transform((v) => v ?? null),
    direction: z.enum(["multiply", "divide"]).default("multiply"), finalAmount: nullableNum,
    rateSource: z.enum(["master", "manual", "none"]).default("none"), confirmed: z.boolean().default(false),
  }).transform((e) => ({ ...EMPTY_EXCHANGE, ...e })),
  bank: z.object({
    decision: z.enum(["use_matched", "keep_extracted", "ignore"]).nullable().optional().transform((v) => v ?? null),
    bankId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  }),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  action: z.enum(["process", "cancel", "qvc", "confirm", "update_scope", "update_module"]),
  force: z.boolean().optional(),
  moduleId: z.string().trim().max(60).optional(),
  intent: z.enum(["draft", "handoff"]).optional(),
  review: reviewSchema.optional(),
  reason: z.string().trim().max(2000).optional(),
  linkMode: z.enum(["new_record", "append_existing"]).optional(),
  targetModule: z.string().trim().max(120).optional(),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  purchaseAccountId: z.string().nullish(),
  payableAccountId: z.string().nullish(),
  salesAccountId: z.string().nullish(),
  receivableAccountId: z.string().nullish(),
  debitAccountId: z.string().nullish(),
  creditAccountId: z.string().nullish(),
  bankAccountId: z.string().nullish(),
  supplierName: z.string().trim().nullish(),
  customerName: z.string().trim().nullish(),
  currency: z.string().trim().max(10).nullish(),
  totalAmount: z.union([z.number(), z.string()]).nullish(),
  payloadOverrides: z.record(z.any()).optional(),
});

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { id } = idSchema.parse(await ctx.params);
    const data = await documentIntakeService.get(id, scope);
    if (!data) return apiError("NOT_FOUND", "Document job not found in your scope.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardIntake("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const actorName = session.fullName ?? null;
    if (body.action === "process") {
      sweepRateLimiter();
      const rl = checkRateLimit("process", session.userId);
      if (!rl.ok) return apiError("RATE_LIMITED", `Too many processing requests — retry in ${rl.retryAfterSec}s.`, 429);
      const res = await documentIntakeService.processJob(id, session.userId, actorName, scope, { force: body.force === true });
      return apiOk({ result: res });
    }
    if (body.action === "cancel") {
      const res = await documentIntakeService.cancelJob(id, session.userId, actorName, scope);
      return apiOk({ result: res });
    }
    if (body.action === "update_module") {
      if (!body.moduleId) return apiError("VALIDATION", "moduleId is required.", 400);
      const res = await documentIntakeService.updateModule(id, body.moduleId, session.userId, actorName, scope);
      return apiOk({ result: res });
    }
    if (body.action === "update_scope") {
      const res = await documentIntakeService.updateJobScope(
        id,
        { countryId: body.countryId, countryBranchId: body.countryBranchId, cityBranchId: body.cityBranchId },
        session.userId,
        actorName,
        scope,
      );
      return apiOk({ result: res });
    }
    if (body.action === "confirm") {
      const res = await documentIntakeService.confirmDraft(
        id,
        {
          linkMode: body.linkMode,
          targetModuleOverride: body.targetModule ?? null,
          countryId: body.countryId,
          countryBranchId: body.countryBranchId,
          cityBranchId: body.cityBranchId,
          purchaseAccountId: body.purchaseAccountId,
          payableAccountId: body.payableAccountId,
          salesAccountId: body.salesAccountId,
          receivableAccountId: body.receivableAccountId,
          debitAccountId: body.debitAccountId,
          creditAccountId: body.creditAccountId,
          bankAccountId: body.bankAccountId,
          supplierName: body.supplierName,
          customerName: body.customerName,
          currency: body.currency,
          totalAmount: body.totalAmount,
          payloadOverrides: body.payloadOverrides,
          review: body.review as ReviewState | undefined,
          intent: body.intent,
        },
        session.userId, actorName, scope,
      );
      return apiOk({ result: res });
    }
    const res = await documentIntakeService.sendToQvc(id, body.reason || "Sent to QVC for manual review.", session.userId, actorName, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
