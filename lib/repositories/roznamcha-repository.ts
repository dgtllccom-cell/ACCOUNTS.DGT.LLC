import type { RoznamchaPostingPlan } from "@/lib/services/roznamcha-service";

export type RoznamchaRepository = {
  createDraft(input: RoznamchaPostingPlan): Promise<{ id: string; voucherNo: string }>;
  markPosted(input: { roznamchaEntryId: string; journalEntryId: string; postedBy: string }): Promise<void>;
};

