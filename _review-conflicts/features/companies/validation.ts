import { z } from "zod";

export const workspaceSetupSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(240).optional(),
  baseCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  branchName: z.string().trim().min(2).max(200),
  branchCode: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
  ownerFullName: z.string().trim().min(2).max(200)
});

export type WorkspaceSetupInput = z.infer<typeof workspaceSetupSchema>;
