export type DocumentScopeParts = {
  countryName?: string | null;
  branchName?: string | null;
  personAccountCode?: string | null;
  personAccountName?: string | null;
  moduleType?: string | null;
  documentType?: string | null;
  sourceRecordNo?: string | null;
};

function slugPart(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildDocumentFolderPath(parts: DocumentScopeParts) {
  const segments = [
    parts.countryName?.trim(),
    parts.branchName?.trim(),
    parts.personAccountCode?.trim() || parts.personAccountName?.trim(),
    parts.moduleType?.trim(),
    parts.documentType?.trim()
  ].filter(Boolean) as string[];

  return segments.map(slugPart).filter(Boolean).join("/");
}

export function buildDocumentFileName(
  parts: DocumentScopeParts & {
    createdAt?: string | Date | null;
    extension?: string | null;
  }
) {
  const dateToken = parts.createdAt
    ? new Date(parts.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const body = [
    parts.personAccountCode?.trim() || parts.personAccountName?.trim(),
    parts.personAccountName?.trim(),
    parts.sourceRecordNo?.trim(),
    parts.moduleType?.trim(),
    parts.documentType?.trim()
  ]
    .filter(Boolean)
    .map(slugPart)
    .filter(Boolean)
    .join("_");

  const base = body || "DOCUMENT";
  const extension = parts.extension?.replace(/^\./, "").trim() || "pdf";
  return `${base}_${dateToken}.${extension}`;
}

export function buildDocumentDestinationLabel(parts: DocumentScopeParts) {
  return [
    parts.countryName?.trim(),
    parts.branchName?.trim(),
    parts.personAccountCode?.trim() || parts.personAccountName?.trim(),
    parts.moduleType?.trim(),
    parts.documentType?.trim()
  ]
    .filter(Boolean)
    .join(" → ");
}

export function normalizeDocumentSearch(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
