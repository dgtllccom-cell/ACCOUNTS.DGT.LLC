export type CountryEmailRecord = {
  id?: string | null;
  name?: string | null;
  iso2?: string | null;
  official_email?: string | null;
  admin_email?: string | null;
  email_domain?: string | null;
  email_server_settings?: Record<string, unknown> | null;
};

export type BranchEmailContext = {
  mainBranchName?: string | null;
  mainBranchCode?: string | null;
  cityBranchName?: string | null;
  cityBranchCode?: string | null;
  cityName?: string | null;
};

export type ResolvedCountryEmailConfig = {
  countryId: string | null;
  countryName: string;
  countryCode: string | null;
  officeName: string;
  fromName: string;
  fromEmail: string | null;
  replyTo: string | null;
  adminEmail: string | null;
  emailDomain: string | null;
  mainBranchName: string | null;
  subBranchName: string | null;
  displayBranchName: string;
  signatureText: string;
  signatureHtml: string;
  logoUrl: string | null;
};

const DEFAULT_COUNTRY_EMAILS: Record<string, { officeName: string; email: string; domain: string; logoUrl?: string }> = {
  pk: {
    officeName: "Asmat & Brothers",
    email: "Asmatandbrothers@gmail.com",
    domain: "gmail.com"
  },
  pakistan: {
    officeName: "Asmat & Brothers",
    email: "Asmatandbrothers@gmail.com",
    domain: "gmail.com"
  },
  ae: {
    officeName: "DGT LLC",
    email: "digital.llc@gmail.com",
    domain: "gmail.com"
  },
  uae: {
    officeName: "DGT LLC",
    email: "digital.llc@gmail.com",
    domain: "gmail.com"
  },
  "united arab emirates": {
    officeName: "DGT LLC",
    email: "digital.llc@gmail.com",
    domain: "gmail.com"
  }
};

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\(.+?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function defaultForCountry(country?: CountryEmailRecord | null) {
  const iso = normalizeKey(country?.iso2);
  const name = normalizeKey(country?.name);
  return DEFAULT_COUNTRY_EMAILS[iso] ?? DEFAULT_COUNTRY_EMAILS[name] ?? null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveCountryEmailConfig(country: CountryEmailRecord | null | undefined, branch: BranchEmailContext = {}): ResolvedCountryEmailConfig {
  const defaults = defaultForCountry(country);
  const settings = (country?.email_server_settings ?? {}) as Record<string, unknown>;
  const officeName = String(settings.officeName ?? settings.office_name ?? defaults?.officeName ?? country?.name ?? "DAMAAN Business Group ERP");
  const officialEmail = country?.official_email ?? defaults?.email ?? null;
  const adminEmail = country?.admin_email ?? null;
  const emailDomain = country?.email_domain ?? defaults?.domain ?? (officialEmail?.includes("@") ? officialEmail.split("@").pop() ?? null : null);
  const mainBranchName = branch.mainBranchName ?? null;
  const subBranchName = branch.cityBranchName ?? branch.cityName ?? null;
  const branchParts = [mainBranchName, subBranchName].filter(Boolean) as string[];
  const displayBranchName = branchParts.length ? branchParts.join(" - ") : country?.name ?? "Global Office";
  const fromName = branchParts.length ? `${officeName} | ${displayBranchName}` : officeName;
  const logoUrl = typeof settings.logoUrl === "string" ? settings.logoUrl : typeof settings.logo_url === "string" ? settings.logo_url : defaults?.logoUrl ?? null;
  const signatureText = [
    officeName,
    mainBranchName,
    subBranchName,
    officialEmail ? `Email: ${officialEmail}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const signatureHtml = [
    `<strong>${escapeHtml(officeName)}</strong>`,
    mainBranchName ? `<div>${escapeHtml(mainBranchName)}</div>` : "",
    subBranchName ? `<div>${escapeHtml(subBranchName)}</div>` : "",
    officialEmail ? `<div>Email: ${escapeHtml(officialEmail)}</div>` : ""
  ]
    .filter(Boolean)
    .join("");

  return {
    countryId: country?.id ?? null,
    countryName: country?.name ?? "Global",
    countryCode: country?.iso2 ?? null,
    officeName,
    fromName,
    fromEmail: officialEmail,
    replyTo: officialEmail,
    adminEmail,
    emailDomain,
    mainBranchName,
    subBranchName,
    displayBranchName,
    signatureText,
    signatureHtml,
    logoUrl
  };
}

export function appendCountryEmailSignature(body: string, config: ResolvedCountryEmailConfig) {
  const trimmed = body.trimEnd();
  if (!config.signatureText) return trimmed;
  if (trimmed.includes(config.signatureText)) return trimmed;
  return `${trimmed}\n\n--\n${config.signatureText}`;
}
