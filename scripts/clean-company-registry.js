const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "features", "companies", "components", "company-registry.tsx");
let content = fs.readFileSync(target, "utf8");

// Remove the duplicate block
const badPattern = `      if (rawList.length > 0) {
        const mapped: CompanyRegistryItem[] = rawList.map((c: any, i: number) => {
  const [openCreateModal, setOpenCreateModal] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadCompaniesFromDb = async () => {
    setLoading(true);
    try {
      const res: any = await apiGet(\`/api/erp/companies?lang=\${encodeURIComponent(lang || "en")}\`);
      const rawList: any[] = Array.isArray(res?.companies) 
        ? res.companies 
        : Array.isArray(res?.data?.companies) 
        ? res.data.companies 
        : [];

      if (rawList.length > 0) {
        const mapped: CompanyRegistryItem[] = rawList.map((c: any, i: number) => {`;

const goodReplacement = `      if (rawList.length > 0) {
        const mapped: CompanyRegistryItem[] = rawList.map((c: any, i: number) => {`;

if (content.includes(badPattern)) {
  content = content.replace(badPattern, goodReplacement);
  fs.writeFileSync(target, content, "utf8");
  console.log("SUCCESSFULLY CLEANED company-registry.tsx");
} else {
  console.log("PATTERN NOT FOUND DIRECTLY, CHECKING SUBSTRING");
}
