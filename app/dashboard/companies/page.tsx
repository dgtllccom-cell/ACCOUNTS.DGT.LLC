import { OrganizationFoundation } from "@/features/companies/components/organization-foundation";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";

export const metadata = { title: "Companies & Branches" };


export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        titleKey="dph.companies_title"
        titleFallback="Companies and branches"
        descKey="dph.companies_desc"
        descFallback="Workspace entities, branch structure, and membership boundaries."
      />
      <OrganizationFoundation />
    </div>
  );
}
