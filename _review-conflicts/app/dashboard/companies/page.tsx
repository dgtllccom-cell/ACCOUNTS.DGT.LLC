import { OrganizationFoundation } from "@/features/companies/components/organization-foundation";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies and branches</h1>
        <p className="text-sm text-muted-foreground">
          Workspace entities, branch structure, and membership boundaries.
        </p>
      </div>
      <OrganizationFoundation />
    </div>
  );
}
