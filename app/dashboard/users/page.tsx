import { AdminUserManagementPanel } from "@/features/users/components/admin-user-management-panel";

export default function UsersPage() {
  return <AdminUserManagementPanel />;
}

export function generateMetadata() {
  return {
    title: "Users & Branch Code Directory | Admin Control Panel",
    description: "Hierarchical user management organized by Country Main Branches, City Branch Codes, and Admin Role Access.",
  };
}
