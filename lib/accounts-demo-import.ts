import { z } from "zod";

export const alRasDemoReference = /^DEMO-ALRAS-20261126-B-(AE|AF|IN|PK|IR|CN|HK|SG|RU|TR)-(\d{3})$/;
export const demoBranchCode = "ARE-AEDU-001";
const limits = { AE: 100, AF: 100, IN: 50, PK: 50, IR: 50, CN: 50, HK: 25, SG: 25, RU: 25, TR: 25 };
export const demoRowSchema = z.object({
  reference: z.string().regex(alRasDemoReference),
  name: z.string().trim().min(12).max(200),
  category: z.enum(["S", "P/S"]),
}).strict().superRefine((row, ctx) => {
  const parts = alRasDemoReference.exec(row.reference);
  if (!parts) return;
  const [, code, serial] = parts;
  if (Number(serial) < 1 || Number(serial) > limits[code as keyof typeof limits]) {
    ctx.addIssue({ code: "custom", path: ["reference"], message: "Reference is outside the approved ranges." });
  }
  if (!row.name.startsWith("DEMO ") || !row.name.endsWith(` ${code}-${serial}`)) {
    ctx.addIssue({ code: "custom", path: ["name"], message: "Name must be marked DEMO and end in the reference country and sequence." });
  }
});

export const demoRowsSchema = z.array(demoRowSchema).min(1).max(500).superRefine((rows, ctx) => {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    if (seen.has(row.reference)) ctx.addIssue({ code: "custom", path: [i, "reference"], message: "Duplicate reference in file." });
    seen.add(row.reference);
  });
});

export const demoRequestSchema = z.object({
  mode: z.literal("al-ras-demo"),
  action: z.enum(["preview", "create"]),
  rows: demoRowsSchema,
}).strict().refine((body) => body.action === "preview" || body.rows.length <= 5, "Send no more than five writes per request.");

export type DemoRow = z.infer<typeof demoRowSchema>;
export type DemoRowResult = DemoRow & {
  status: "ready" | "existing" | "blocked" | "created" | "unknown";
  country: string;
  code?: string;
  reason?: string;
};

export function demoCountry(reference: string) {
  return alRasDemoReference.exec(reference)?.[1] ?? "";
}

export function demoAccountPayload(
  row: DemoRow,
  branch: { id: string; countryId: string; countryBranchId: string },
  addressCountryId: string,
) {
  return {
    scope: "city_branch",
    operationalDomain: "business",
    countryId: branch.countryId,
    countryBranchId: branch.countryBranchId,
    cityBranchId: branch.id,
    addressCountryId,
    accountAddress: { countryId: addressCountryId },
    code: "AUTO",
    manualReferenceNumber: row.reference,
    name: row.name,
    currency: "AED",
    openingBalance: 0,
    isControlAccount: false,
    category: row.category,
    kind: row.category === "P/S" ? "income" : "asset",
  } as const;
}
