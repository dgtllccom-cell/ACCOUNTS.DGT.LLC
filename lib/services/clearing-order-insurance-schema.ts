import { z } from "zod";

export const policySchema = z.object({
  insurerName: z.string().trim().min(1).max(200),
  insurerAccountId: z.string().uuid().nullish(),
  policyNo: z.string().trim().min(1).max(120),
  coveredCargo: z.string().trim().min(1).max(500),
  insuredValue: z.number().positive(),
  currency: z.string().trim().length(3),
  coverageFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  coverageTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  territory: z.string().trim().max(300).nullish(),
  fromLegNo: z.number().int().min(1),
  toLegNo: z.number().int().min(1),
  premiumAmount: z.number().min(0).nullish(),
  premiumCurrency: z.string().trim().max(3).nullish(),
  remarks: z.string().trim().max(1000).nullish(),
});
