import { z } from "zod";

export const customer360ActivitySchema = z.object({
  customerId: z.string().uuid(),
  activityType: z.enum(["Call", "Meeting", "Message", "Note"]).default("Note"),
  subject: z.string().trim().max(200).optional(),
  notes: z.string().trim().min(1).max(4000),
  promiseDate: z.string().date().nullish(),
  promiseAmount: z.coerce.number().finite().nonnegative().nullish(),
});

export const customer360QuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  countryId: z.union([z.string().uuid(), z.literal("all")]).optional(),
  branchId: z.union([z.string().uuid(), z.literal("all")]).optional(),
  assignedUser: z.string().trim().max(200).optional(),
  search: z.string().trim().max(200).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(["all", "active", "at_risk"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).refine((q) => !q.startDate || !q.endDate || q.startDate <= q.endDate, { path: ["endDate"], message: "End date must follow start date" });
