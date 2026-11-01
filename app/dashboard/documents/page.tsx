import { requireErpSession } from "@/lib/auth/session";
import { reportScopeLevel } from "@/lib/reports/report-access";
import { DocumentManager, type DocumentScopeRole } from "@/features/documents/components/document-manager";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Document Management & Camera Capture"
};

export default async function DocumentsPage() {
  // the scope the screen opens in is the login's REAL reach, never a Super Admin default
  const session = await requireErpSession();
  const level = reportScopeLevel(session);
  const allowed: DocumentScopeRole[] = level === "global" ? ["super_admin", "country_admin", "branch_user"] : level === "country" ? ["country_admin", "branch_user"] : ["branch_user"];
  return <DocumentManager initialScope={allowed[0]} allowedScopes={allowed} />;
}
