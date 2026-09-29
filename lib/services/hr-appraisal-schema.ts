import { z } from "zod";

export const goalsSchema = z.array(
  z.object({
    title: z.string().trim().min(1).max(300),
    kpiType: z.enum(["manual", "task_completion", "task_on_time", "attendance_rate"]).optional(),
    target: z.number().nullish(),
    actual: z.number().nullish(),
    unit: z.string().trim().max(30).nullish(),
    weight: z.number().min(0).max(100).optional(),
    score: z.number().min(1).max(5).nullish(),
    comments: z.string().trim().max(2000).nullish(),
  })
).max(30);
