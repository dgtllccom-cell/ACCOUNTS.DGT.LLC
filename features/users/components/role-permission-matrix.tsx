import { systemRoles } from "@/lib/permissions/model";

export function RolePermissionMatrix() {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-medium">System role templates</h2>
        <p className="text-sm text-muted-foreground">Stored as seedable permissions, then customized per company.</p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {Object.entries(systemRoles).map(([role, permissions]) => (
          <div key={role} className="rounded-md border bg-background p-4">
            <h3 className="capitalize font-medium">{role}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{permissions.length} permissions</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {permissions.slice(0, 6).map((permission) => (
                <span key={permission} className="rounded-md bg-muted px-2 py-1 text-xs">
                  {permission}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
