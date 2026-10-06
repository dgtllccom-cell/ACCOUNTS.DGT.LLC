import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { systemRoles } from "@/lib/permissions/model";
import { groupPermissionCatalog } from "@/lib/permissions/catalog";

export function RolePermissionMatrix() {
  const lang = useActiveLanguage();
  const groupedCatalog = groupPermissionCatalog();
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{t(lang, "cbs.roles_permissions_word", "Roles & Permissions")}</h2>
            <p className="text-sm text-muted-foreground">{t(lang, "urf.role_permissions_hint", "Defaults load by role. You can customize permissions before saving.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(groupedCatalog)
              .slice(0, 4)
              .map(([group, perms]) => (
                <span key={group} className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-foreground">
                  {group} · {perms.length}
                </span>
              ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">
        {Object.entries(systemRoles).map(([role, permissions]) => (
          <div key={role} className="rounded-xl border bg-background p-4 shadow-sm">
            <h3 className="capitalize font-semibold">{role}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{permissions.length} permissions · scoped by the shared permission engine</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {permissions.slice(0, 6).map((permission) => (
                <span key={permission} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">
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
