import { permissionCatalog } from "@/lib/permissions/catalog";

/**
 * Compact print summary of a branch/user permission grant set.
 *
 * A saved branch stores `permission_grants: string[]` (catalog keys). For print
 * we do NOT reproduce the interactive permission cards — we collapse the whole
 * catalog into a few business buckets and show a small ✓ (granted) / × (not
 * granted) per permission, 3 columns, so the entire Roles & Permissions summary
 * fits in a fraction of one A4 page.
 */

export type PermissionPrintItem = { label: string; enabled: boolean };
export type PermissionPrintGroup = { title: string; items: PermissionPrintItem[] };
export type PermissionPrintSummary = {
  template: string;
  grantedCount: number;
  totalCount: number;
  groups: PermissionPrintGroup[];
};

/** Catalog group -> one of the six print buckets (spec §4). */
const BUCKET_FOR_GROUP: Record<string, string> = {
  Dashboard: "Dashboard & Master",
  Masters: "Dashboard & Master",
  Branch: "Dashboard & Master",
  Settings: "Dashboard & Master",

  "New Entry / Users": "Users & Roles",
  Administration: "Users & Roles",

  Accounts: "Finance / Transactions",
  Ledgers: "Finance / Transactions",
  Finance: "Finance / Transactions",
  Operations: "Finance / Transactions",
  "Journal / Roznamcha": "Finance / Transactions",
  "Journal / Daily Payment Entry": "Finance / Transactions",
  "Purchase & Sale / Purchase": "Finance / Transactions",
  "Purchase & Sale / Sales": "Finance / Transactions",
  "UAE Tax & e-Invoicing": "Finance / Transactions",

  Reports: "Reports",
  "Reports / Ledger Reports": "Reports",
  "Reports / Management Forms": "Reports",
  "Reports / Purchase Reports": "Reports",
  "Reports / Roznamcha Reports": "Reports",
  "Reports / Sales Reports": "Reports",

  "Shipping Line / Clearing Agent / Shipping Line": "Shipping / Clearing",
  "Shipping Line / Clearing Agent / Clearing Agent": "Shipping / Clearing",

  Communication: "Additional Modules",
  "Message System": "Additional Modules",
  "Document Management": "Additional Modules",
  "KYC / Compliance": "Additional Modules",
};

const BUCKET_ORDER = [
  "Dashboard & Master",
  "Users & Roles",
  "Finance / Transactions",
  "Reports",
  "Shipping / Clearing",
  "Additional Modules",
];

export function buildPermissionPrintSummary(
  grantedKeys: string[] | null | undefined,
  template?: string | null,
): PermissionPrintSummary {
  const granted = new Set((grantedKeys ?? []).filter(Boolean));
  const buckets = new Map<string, PermissionPrintItem[]>();

  for (const perm of permissionCatalog) {
    if (perm.hidden) continue;
    const bucket = BUCKET_FOR_GROUP[perm.group] ?? "Additional Modules";
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push({ label: perm.label, enabled: granted.has(perm.key) });
  }

  const groups: PermissionPrintGroup[] = BUCKET_ORDER
    .filter((b) => buckets.has(b))
    .map((b) => ({
      title: b,
      items: buckets.get(b)!.sort((a, z) => a.label.localeCompare(z.label)),
    }));

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
  const grantedCount = groups.reduce((n, g) => n + g.items.filter((i) => i.enabled).length, 0);

  return { template: template || "-", grantedCount, totalCount, groups };
}
