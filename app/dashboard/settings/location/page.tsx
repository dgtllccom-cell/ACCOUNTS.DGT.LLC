import { LocationManagementWizard } from "@/features/locations/components/location-management-wizard";

export default async function LocationSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <LocationManagementWizard activeTab={tab} />;
}
