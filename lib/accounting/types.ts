import { z } from "zod";

export const moneySchema = z.coerce.number().positive().finite();

export const journalLineSchema = z
  .object({
    accountId: z.string().uuid(),
    description: z.string().max(500).optional(),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0)
  })
  .refine((line) => (line.debit > 0 && line.credit === 0) || (line.credit > 0 && line.debit === 0), {
    message: "Each journal line must have either debit or credit, not both."
  });

export const journalDraftSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  entryDate: z.string(),
  memo: z.string().max(1000).optional(),
  lines: z.array(journalLineSchema).min(2)
});

export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type JournalDraftInput = z.infer<typeof journalDraftSchema>;
