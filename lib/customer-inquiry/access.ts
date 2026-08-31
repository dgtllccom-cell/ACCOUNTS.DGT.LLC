import type { ErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import type { InquiryRow, InquiryStatus } from "./types";

/**
 * CUSTOMER INQUIRY access model — enforced SERVER-SIDE on every read & mutation.
 *
 *  - super_admin ............ see / manage every inquiry across all countries,
 *                             review the full register + audit trail.
 *  - country_admin /
 *    main_branch_admin ...... inquiries whose scope country is one of theirs.
 *  - city_branch_admin ...... inquiries whose scope city / country-branch is theirs.
 *  - everybody else ......... their own inquiries (created_by = them) OR inquiries
 *                             assigned to them (assigned_to = them). They may run the
 *                             full workflow on those, add notes / attachments, and
 *                             link / convert to a customer.
 */

const MANAGER_ROLES = new Set(["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]);

export type InquiryScope = {
  isManager: boolean;
  level: "global" | "country" | "branch";
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
};

export function canManageInquiries(session: ErpSession): boolean {
  return session.isSuperAdmin || session.roles.some((r) => MANAGER_ROLES.has(r));
}

export function inquiryScope(session: ErpSession): InquiryScope {
  const rs = resolveReportScope(session);
  return {
    isManager: canManageInquiries(session),
    level: rs.level === "global" ? "global" : rs.level === "country" ? "country" : "branch",
    countryIds: session.isSuperAdmin ? [] : session.countryIds ?? [],
    countryBranchIds: session.isSuperAdmin ? [] : session.countryBranchIds ?? [],
    cityBranchIds: session.isSuperAdmin ? [] : session.cityBranchIds ?? [],
    countryId: rs.countryId,
    countryBranchId: rs.countryBranchId,
    cityBranchId: rs.branchId,
  };
}

/** Is `session` a manager for THIS inquiry's scope? */
export function isInquiryManager(
  session: ErpSession,
  row: Pick<InquiryRow, "created_by" | "country_id" | "country_branch_id" | "city_branch_id">,
): boolean {
  if (session.isSuperAdmin) return true;
  if (!canManageInquiries(session)) return false;
  const s = inquiryScope(session);
  if (s.level === "global") return true;
  if (s.level === "country") {
    return Boolean(row.country_id && new Set(s.countryIds).has(row.country_id));
  }
  const cb = new Set(s.countryBranchIds);
  const city = new Set(s.cityBranchIds);
  return Boolean((row.city_branch_id && city.has(row.city_branch_id)) || (row.country_branch_id && cb.has(row.country_branch_id)));
}

export function canViewInquiry(session: ErpSession, row: InquiryRow): boolean {
  if (row.created_by === session.userId) return true;
  if (row.assigned_to === session.userId) return true;
  return isInquiryManager(session, row);
}

/** Everyone who can view an inquiry can also run its workflow (it is a light process). */
export function canEditInquiry(session: ErpSession, row: InquiryRow): boolean {
  return canViewInquiry(session, row);
}

/**
 * Next statuses `session` may set on `row` from its current status.
 * The workflow: new → ai_draft → confirmed → in_progress → follow_up
 *               → customer_approved → converted   (also closed / lost from most states)
 */
export function allowedNextStatuses(session: ErpSession, row: InquiryRow): InquiryStatus[] {
  if (!canEditInquiry(session, row)) return [];
  const s = row.status;
  const out = new Set<InquiryStatus>();
  switch (s) {
    case "new":
    case "ai_draft":
      out.add("confirmed");
      break;
    case "confirmed":
      out.add("in_progress");
      out.add("follow_up");
      break;
    case "in_progress":
      out.add("follow_up");
      out.add("customer_approved");
      break;
    case "follow_up":
      out.add("in_progress");
      out.add("customer_approved");
      break;
    case "customer_approved":
      out.add("converted");
      break;
    default:
      break;
  }
  if (s !== "converted" && s !== "closed" && s !== "lost") {
    out.add("closed");
    out.add("lost");
  }
  return [...out];
}
