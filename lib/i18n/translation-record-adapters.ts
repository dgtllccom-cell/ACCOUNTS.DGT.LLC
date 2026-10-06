export const translationRecordAdapters = {
  purchase_orders: { resource: "purchases", writeAction: "update", label: "Purchase Order", integration: "complete" },
  sales_orders: { resource: "sales", writeAction: "update", label: "Sales Order", integration: "complete" },
  roznamcha_entries: { resource: "roznamcha", writeAction: "post", label: "Cash / Daily Payment", integration: "complete" }
} as const;

export type TranslationRecordTable = keyof typeof translationRecordAdapters;

export function getTranslationRecordAdapter(value: string) {
  return Object.prototype.hasOwnProperty.call(translationRecordAdapters, value)
    ? translationRecordAdapters[value as TranslationRecordTable]
    : null;
}
