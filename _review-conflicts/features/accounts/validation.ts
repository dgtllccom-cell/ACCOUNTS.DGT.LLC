import { z } from "zod";

export const accountFormSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional().or(z.literal("")),
  parentId: z.string().uuid().optional().or(z.literal("")),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  kind: z.enum(["asset", "liability", "equity", "income", "expense"]),
  currency: z.string().length(3),
  isControlAccount: z.boolean().default(false)
});

export type AccountFormInput = z.infer<typeof accountFormSchema>;
