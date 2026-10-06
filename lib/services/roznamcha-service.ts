import { ledgerService, type LedgerPostingLine, type LedgerPostingPlan } from "@/lib/services/ledger-service";
import type { PaymentEntryType, RoznamchaType } from "@/lib/accounting/roznamcha-flow";

export type RoznamchaLine = LedgerPostingLine & {
  paymentEntryType: PaymentEntryType;
};

export type RoznamchaPostingPlan = {
  type: RoznamchaType;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  entryDate: string;
  journalNo: string;
  voucherNo: string;
  narration?: string;
  referenceNo?: string;
  lines: RoznamchaLine[];
  ledgerPosting: LedgerPostingPlan;
};

export class RoznamchaValidationError extends Error {}

export class RoznamchaService {
  validateScope(input: {
    type: RoznamchaType;
    countryId?: string | null;
    cityBranchId?: string | null;
  }) {
    if (input.type === "super_admin" && input.countryId) {
      throw new RoznamchaValidationError("Super Admin Roznamcha must not be limited to one country");
    }

    if (input.type === "country" && !input.countryId) {
      throw new RoznamchaValidationError("Country Roznamcha requires country");
    }

    if (input.type === "branch" && !input.cityBranchId) {
      throw new RoznamchaValidationError("Branch Roznamcha requires city branch");
    }
  }

  createPostingPlan(input: {
    type: RoznamchaType;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    entryDate: string;
    journalNo: string;
    voucherNo: string;
    narration?: string;
    referenceNo?: string;
    lines: RoznamchaLine[];
  }): RoznamchaPostingPlan {
    this.validateScope(input);

    const ledgerPosting = ledgerService.createPostingPlan({
      countryId: input.countryId,
      countryBranchId: input.countryBranchId,
      cityBranchId: input.cityBranchId,
      entryDate: input.entryDate,
      lines: input.lines
    });

    return {
      ...input,
      ledgerPosting
    };
  }
}

export const roznamchaService = new RoznamchaService();

