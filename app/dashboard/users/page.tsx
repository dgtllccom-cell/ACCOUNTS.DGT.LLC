import { RolePermissionMatrix } from "@/features/users/components/role-permission-matrix";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users and roles</h1>
        <p className="text-sm text-muted-foreground">
          Role assignments and permission checks for secure company operations.
        </p>
      </div>
      <RolePermissionMatrix />
    </div>
  );
}
