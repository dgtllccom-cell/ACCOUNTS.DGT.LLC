import fs from 'fs';

const filePath = 'features/accounts/components/account-live-report-panel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Helper wrapper for field values
const helperFn = `
  const trName = (val: string | null | undefined) => {
    if (!val || val === "-") return "-";
    return lang === "ur" ? transliterateProperNoun(val, "ur") : val;
  };

  const trTerm = (val: string | null | undefined) => {
    if (!val || val === "-") return "-";
    return localizeTerm(val, lang);
  };
`;

if (!content.includes('const trName =')) {
  content = content.replace('const t = (key: string, fallback: string) => liveReportLabels[key]?.[lang] || liveReportLabels[key]?.en || fallback;', 'const t = (key: string, fallback: string) => liveReportLabels[key]?.[lang] || liveReportLabels[key]?.en || fallback;\n' + helperFn);
}

// Replace field definitions to use trName and trTerm
content = content.replace(
  `{ label: t("customerName", "Customer Name"), value: custObj?.customer_name || custObj?.name || (accountTitle === "Customer" ? accountName : "-") },`,
  `{ label: t("customerName", "Customer Name"), value: trName(custObj?.customer_name || custObj?.name || (accountTitle === "Customer" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("customerType", "Customer Type"), value: custObj?.customer_type || subType || "Company / Individual" },`,
  `{ label: t("customerType", "Customer Type"), value: trTerm(custObj?.customer_type || subType || "Company / Individual") },`
);

content = content.replace(
  `{ label: t("companyName", "Company Name"), value: companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name || (accountTitle === "Company" ? accountName : "-") },`,
  `{ label: t("companyName", "Company Name"), value: trName(companyDetail?.companyName || companyDetail?.name || companyDetail?.legal_name || (accountTitle === "Company" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("bankName", "Bank Name"), value: bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name || (accountTitle === "Bank" ? accountName : "-") },`,
  `{ label: t("bankName", "Bank Name"), value: trName(bankDetail?.bank_name || bankDetail?.bankName || bankDetail?.name || (accountTitle === "Bank" ? accountName : "-")) },`
);

content = content.replace(
  `{ label: t("accountTitle", "Account Title"), value: bankDetail?.account_title || accountName || "-" },`,
  `{ label: t("accountTitle", "Account Title"), value: trName(bankDetail?.account_title || accountName || "-") },`
);

content = content.replace(
  `{ label: t("accountName", "Account Name"), value: accountName || "-" },`,
  `{ label: t("accountName", "Account Name"), value: trName(accountName || "-") },`
);

content = content.replace(
  `{ label: t("accountTitle", "Account Title"), value: accountTitle || "-" },`,
  `{ label: t("accountTitle", "Account Title"), value: trTerm(accountTitle || "-") },`
);

content = content.replace(
  `{ label: t("subType", "Sub Type"), value: subType || "-" },`,
  `{ label: t("subType", "Sub Type"), value: trTerm(subType || "-") },`
);

content = content.replace(
  `{ label: t("category", "Category"), value: category || "-" },`,
  `{ label: t("category", "Category"), value: trTerm(category || "-") },`
);

content = content.replace(
  `{ label: t("country", "Country"), value: selectedCountryName || "-" },`,
  `{ label: t("country", "Country"), value: trTerm(selectedCountryName || "-") },`
);

content = content.replace(
  `{ label: t("branch", "Branch"), value: selectedBranchName || "-" },`,
  `{ label: t("branch", "Branch"), value: trName(selectedBranchName || "-") },`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fields updated with proper trName / trTerm localization!');
