import type { PurchaseOrderTranslationField } from "@/lib/i18n/purchase-order-translations";

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function roznamchaTranslationFields(input: { narration?: unknown; lines?: unknown; paymentDetails?: unknown }) {
  const fields: PurchaseOrderTranslationField[] = [];
  const narration = clean(input.narration);
  if (narration) fields.push({ fieldName: "narration", value: narration, mode: "translate" });
  const lines = Array.isArray(input.lines) ? input.lines as Record<string, any>[] : [];
  lines.forEach((line, index) => {
    const description = clean(line.description);
    if (description) fields.push({ fieldName: `lines.${index}.description`, value: description, mode: "translate" });
  });
  const details = input.paymentDetails && typeof input.paymentDetails === "object" ? input.paymentDetails as Record<string, any> : {};
  const detailFields = [
    ["receiver_sender_name", details.receiverSenderName ?? details.receiver],
    ["purpose", details.purpose],
    ["business_name", details.businessName ?? details.bizName],
    ["invoice_name", details.invoiceName],
    ["purchase_info", details.purchaseInfo],
    ["transfer_info", details.transferInfo]
  ] as const;
  for (const [fieldName, value] of detailFields) {
    const text = clean(value);
    if (text) fields.push({ fieldName: `payment.${fieldName}`, value: text, mode: fieldName.endsWith("name") ? "transliterate" : "translate" });
  }
  return fields;
}
