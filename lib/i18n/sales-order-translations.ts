import type { PurchaseOrderTranslationField } from "@/lib/i18n/purchase-order-translations";

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function salesOrderTranslationFields(input: { formData?: unknown; customerName?: unknown; productSummary?: unknown }) {
  const wrapper = input.formData && typeof input.formData === "object" ? input.formData as Record<string, any> : {};
  const form = wrapper.form && typeof wrapper.form === "object" ? wrapper.form as Record<string, any> : wrapper;
  const goods = Array.isArray(wrapper.goodsEntries) ? wrapper.goodsEntries as Record<string, any>[] : [];
  const text = (...values: unknown[]) => values.map(clean).find(Boolean) || "";
  const fields: PurchaseOrderTranslationField[] = [
    { fieldName: "customer_name", value: text(input.customerName, form.customerAccountName, form.customerName), mode: "transliterate" },
    { fieldName: "sales_account_name", value: text(form.salesAccountName), mode: "transliterate" },
    { fieldName: "purchase_account_name", value: text(form.purchaseAccountName), mode: "transliterate" },
    { fieldName: "supplier_name", value: text(form.supplierName), mode: "transliterate" },
    { fieldName: "remarks", value: text(form.orderReportRemarks, form.remarks), mode: "translate" },
    { fieldName: "country_name", value: text(form.branchCountry, form.countryName), mode: "transliterate" },
    { fieldName: "branch_name", value: text(form.branchName), mode: "transliterate" },
    { fieldName: "product_name", value: goods.map((item) => text(item.goodsName, item.productName)).filter(Boolean).join(", ") || text(input.productSummary), mode: "transliterate" },
    { fieldName: "goods_description", value: goods.map((item) => text(item.description, item.goodsDescription)).filter(Boolean).join("; "), mode: "translate" }
  ];
  goods.forEach((item, index) => fields.push(
    { fieldName: `items.${index}.goods_name`, value: text(item.goodsName, item.productName), mode: "transliterate" },
    { fieldName: `items.${index}.description`, value: text(item.description, item.goodsDescription), mode: "translate" },
    { fieldName: `items.${index}.brand`, value: text(item.brand), mode: "transliterate" },
    { fieldName: `items.${index}.size`, value: text(item.size), mode: "transliterate" },
    { fieldName: `items.${index}.origin`, value: text(item.origin), mode: "transliterate" },
    { fieldName: `items.${index}.unit_name`, value: text(item.unitName, item.qtyName), mode: "translate" }
  ));
  return fields.filter((field) => field.value);
}
