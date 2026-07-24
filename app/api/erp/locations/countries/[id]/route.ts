import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { linkEmailAccount } from "@/lib/api/email-link";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new Error("Only Super Admin can update countries.");

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string | null;
      iso2?: string | null;
      iso3?: string | null;
      currencyCode?: string | null;
      defaultLanguageCode?: string | null;
      isActive?: boolean | null;
      officialEmail?: string | null;
      adminEmail?: string | null;
      whatsappNumber?: string | null;
    };

    // Email checks removed as these are no longer required in location setup

    const country = await locationsRepository.updateCountry({
      countryId: id,
      name: body.name,
      iso2: body.iso2,
      iso3: body.iso3,
      currencyCode: body.currencyCode,
      defaultLanguageCode: body.defaultLanguageCode,
      isActive: body.isActive,
      officialEmail: body.officialEmail,
      adminEmail: body.adminEmail,
      whatsappNumber: body.whatsappNumber
    });

    // Link/Upsert central email accounts
    await linkEmailAccount({
      countryId: country.id,
      scope: "country",
      displayName: `${country.name} Official`,
      emailAddress: country.official_email,
      adminEmail: country.admin_email,
      isActive: country.is_active
    });

    return apiOk({ country });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new Error("Only Super Admin can delete countries.");

    const { id } = await params;
    await locationsRepository.deleteCountry(id);

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
