import { redirect } from "next/navigation";

export const metadata = { title: "Template Color" };

// The named colour routes live at /dashboard/settings/template-color/[color].
// The bare index is only a sidebar grouping target — send it to Settings,
// where the current template colour is shown and can be changed.
export default function TemplateColorIndexPage() {
  redirect("/dashboard/settings" as any);
}
