export {
  buildVerifiedTranslationSet,
  resolveVerifiedTranslation,
  translationPendingLabel,
  type VerifiedTranslationMap,
  type VerifiedTranslationSet
} from "@/lib/i18n/verified-record-translations";

export type PurchaseOrderTranslationField = {
  fieldName: string;
  value: string;
  mode: "translate" | "transliterate";
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function purchaseOrderTranslationFields(formData: unknown, items: unknown): PurchaseOrderTranslationField[] {
  const wrapper = formData && typeof formData === "object" ? formData as Record<string, any> : {};
  const form = wrapper.form && typeof wrapper.form === "object" ? wrapper.form as Record<string, any> : wrapper;
  const goods = Array.isArray(items) && items.length > 0
    ? items as Record<string, any>[]
    : Array.isArray(wrapper.goodsEntries) ? wrapper.goodsEntries as Record<string, any>[] : [];
  const text = (...values: unknown[]) => values.map(clean).find(Boolean) || "";
  const fields: PurchaseOrderTranslationField[] = [
    { fieldName: "purchase_account_name", value: text(form.purchaseAccountName), mode: "transliterate" },
    { fieldName: "sales_account_name", value: text(form.salesAccountName), mode: "transliterate" },
    { fieldName: "supplier_name", value: text(form.supplierName, form.purchaseCompanyName), mode: "transliterate" },
    { fieldName: "buyer_name", value: text(form.customerName, form.buyerName), mode: "transliterate" },
    { fieldName: "remarks", value: text(form.orderReportRemarks, form.remarks), mode: "translate" },
    { fieldName: "country_name", value: text(form.branchCountry, form.countryName, form.destinationCountry), mode: "transliterate" },
    { fieldName: "branch_name", value: text(form.branchName, form.purchaseAccountBranch, form.salesAccountBranch), mode: "transliterate" }
  ];

  const goodsNames = goods.map((item) => text(item.goodsName, item.productName)).filter(Boolean);
  const descriptions = goods.map((item) => text(item.description, item.goodsDescription)).filter(Boolean);
  fields.push(
    { fieldName: "product_name", value: goodsNames.join(", "), mode: "transliterate" },
    { fieldName: "goods_description", value: descriptions.join("; "), mode: "translate" }
  );
  goods.forEach((item, index) => {
    const prefix = `items.${index}`;
    fields.push(
      { fieldName: `${prefix}.goods_name`, value: text(item.goodsName, item.productName), mode: "transliterate" },
      { fieldName: `${prefix}.description`, value: text(item.description, item.goodsDescription), mode: "translate" },
      { fieldName: `${prefix}.brand`, value: text(item.brand), mode: "transliterate" },
      { fieldName: `${prefix}.size`, value: text(item.size), mode: "transliterate" },
      { fieldName: `${prefix}.origin`, value: text(item.origin), mode: "transliterate" },
      { fieldName: `${prefix}.unit_name`, value: text(item.unitName, item.qtyName), mode: "translate" }
    );
  });
  return fields.filter((field) => field.value.length > 0);
}
