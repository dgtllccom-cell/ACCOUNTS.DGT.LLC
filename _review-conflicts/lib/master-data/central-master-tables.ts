export type CentralMasterKey =
  | "countries"
  | "states"
  | "districts"
  | "cities"
  | "areas"
  | "postal_codes"
  | "goods"
  | "goods_variations"
  | "products"
  | "product_brands"
  | "product_categories"
  | "product_units"
  | "customers"
  | "suppliers"
  | "banks"
  | "companies"
  | "enterprise_accounts"
  | "warehouses"
  | "country_branches"
  | "city_branches";

export type CentralMasterDefinition = {
  key: CentralMasterKey;
  table: string;
  labelBase: "name";
  legacyNameColumns: string[];
  codeColumns: string[];
  scopeColumns: string[];
};

export const centralMasterDefinitions: CentralMasterDefinition[] = [
  { key: "countries", table: "countries", labelBase: "name", legacyNameColumns: ["name"], codeColumns: ["iso2", "iso3", "currency_code"], scopeColumns: [] },
  { key: "states", table: "states_provinces", labelBase: "name", legacyNameColumns: ["name"], codeColumns: ["code", "postal_code"], scopeColumns: ["country_id"] },
  { key: "districts", table: "districts", labelBase: "name", legacyNameColumns: ["name"], codeColumns: ["code", "postal_code"], scopeColumns: ["country_id", "state_province_id"] },
  { key: "cities", table: "cities", labelBase: "name", legacyNameColumns: ["name"], codeColumns: ["code", "zip_code"], scopeColumns: ["country_id", "state_province_id", "district_id"] },
  { key: "areas", table: "areas", labelBase: "name", legacyNameColumns: ["name"], codeColumns: ["code", "postal_code"], scopeColumns: ["country_id", "state_province_id", "district_id", "city_id"] },
  { key: "postal_codes", table: "postal_codes", labelBase: "name", legacyNameColumns: ["postal_code", "full_address", "area_name"], codeColumns: ["postal_code", "zip_code"], scopeColumns: ["country_id", "state_province_id", "city_id", "area_id"] },
  { key: "goods", table: "goods", labelBase: "name", legacyNameColumns: ["goods_name", "name"], codeColumns: ["chs_code", "goods_code", "product_code"], scopeColumns: ["origin_country_id"] },
  { key: "goods_variations", table: "goods_variations", labelBase: "name", legacyNameColumns: ["brand", "size", "name"], codeColumns: ["code"], scopeColumns: ["goods_id"] },
  { key: "products", table: "products", labelBase: "name", legacyNameColumns: ["name", "product_name", "goods_name"], codeColumns: ["product_code", "sku", "hs_code"], scopeColumns: ["category_id", "brand_id", "unit_id"] },
  { key: "product_brands", table: "product_brands", labelBase: "name", legacyNameColumns: ["name", "brand_name"], codeColumns: ["code", "brand_code"], scopeColumns: [] },
  { key: "product_categories", table: "product_categories", labelBase: "name", legacyNameColumns: ["name", "category_name"], codeColumns: ["code", "category_code"], scopeColumns: [] },
  { key: "product_units", table: "product_units", labelBase: "name", legacyNameColumns: ["name", "unit_name", "symbol"], codeColumns: ["code", "symbol"], scopeColumns: [] },
  { key: "customers", table: "customers", labelBase: "name", legacyNameColumns: ["name", "customer_name", "business_name"], codeColumns: ["customer_code", "manual_ref_no"], scopeColumns: ["country_id", "city_branch_id", "branch_id"] },
  { key: "suppliers", table: "customers", labelBase: "name", legacyNameColumns: ["name", "supplier_name", "customer_name", "business_name"], codeColumns: ["customer_code", "manual_ref_no"], scopeColumns: ["country_id", "city_branch_id", "branch_id"] },
  { key: "banks", table: "banks", labelBase: "name", legacyNameColumns: ["name", "bank_name"], codeColumns: ["bank_code", "swift_code", "iban"], scopeColumns: ["country_id", "branch_id"] },
  { key: "companies", table: "companies", labelBase: "name", legacyNameColumns: ["name", "company_name", "business_name"], codeColumns: ["company_code", "registration_no", "tax_number"], scopeColumns: ["country_id", "branch_id"] },
  { key: "enterprise_accounts", table: "enterprise_accounts", labelBase: "name", legacyNameColumns: ["account_name", "name", "business_name", "company_name"], codeColumns: ["account_code", "account_number", "manual_ref_no", "manual_account_code"], scopeColumns: ["country_id", "country_branch_id", "city_branch_id", "branch_id"] },
  { key: "warehouses", table: "warehouses", labelBase: "name", legacyNameColumns: ["name", "warehouse_name"], codeColumns: ["warehouse_code", "code"], scopeColumns: ["country_id", "branch_id", "city_branch_id"] },
  { key: "country_branches", table: "country_branches", labelBase: "name", legacyNameColumns: ["branch_name", "name"], codeColumns: ["branch_code", "code"], scopeColumns: ["country_id"] },
  { key: "city_branches", table: "city_branches", labelBase: "name", legacyNameColumns: ["branch_name", "name", "city_name"], codeColumns: ["branch_code", "city_code", "code"], scopeColumns: ["country_id", "country_branch_id", "state_province_id", "city_id"] }
];

export function getCentralMasterDefinition(key: string): CentralMasterDefinition | undefined {
  return centralMasterDefinitions.find((definition) => definition.key === key);
}
