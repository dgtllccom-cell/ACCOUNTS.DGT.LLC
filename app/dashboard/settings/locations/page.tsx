import { LocationManagementWizard } from "@/features/locations/components/location-management-wizard";

export default async function LocationsSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <div className="w-full min-h-screen bg-slate-50/50">
      <LocationManagementWizard activeTab={params.tab || "country"} />
    </div>
  );
}
