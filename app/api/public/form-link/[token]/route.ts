/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Public API: /api/public/form-link/[token]
 *
 * No authentication required — this is called by the external form page
 * opened by recipients who have NOT logged in to the ERP.
 *
 * GET  → Validates token, returns form_type and metadata
 * POST → Accepts form data, resolves Country/State/City names to UUIDs,
 *        creates the record in the ERP via existing service functions,
 *        and marks the link as "used"
 */

import { NextRequest, NextResponse } from "next/server";
import { withLocalPg } from "@/lib/db/local-postgres";
import { customersService } from "@/lib/services/customers-service";
import { companiesService } from "@/lib/services/companies-service";

export const dynamic = "force-dynamic";

// ─── helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function resolveLink(token: string) {
  return withLocalPg(async (sql) => {
    const rows = await sql<any[]>`
      select * from external_form_links
      where token = ${token}
      limit 1
    `;
    if (!rows.length) return null;
    const link = rows[0];

    // Auto-expire in-band
    if (
      link.status === "active" &&
      link.expires_at &&
      new Date(link.expires_at) < new Date()
    ) {
      await sql`
        update external_form_links
        set status = 'expired', updated_at = now()
        where token = ${token}
      `;
      link.status = "expired";
    }

    return link;
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) return err("Missing token", 400);

    const link = await resolveLink(token);
    if (!link) return err("Link not found", 404);

    if (link.status === "revoked") return err("This link has been revoked", 410);
    if (link.status === "expired") return err("This link has expired", 410);
    if (link.status === "used" || link.status === "submitted") return err("This link has already been used", 410);

    const payload = {
      token: link.token,
      formType: link.form_type,
      status: link.status,
      createdByName: link.created_by_name ?? null,
      expiresAt: link.expires_at ?? null,
      notes: link.notes ?? null,
    };

    return NextResponse.json({
      ok: true,
      data: payload,
      link: payload
    }, { status: 200 });
  } catch (e: any) {
    console.error("[Public Form Link GET]", e);
    return err("Server error", 500);
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token) return err("Missing token", 400);

    const link = await resolveLink(token);
    if (!link) return err("Link not found", 404);
    if (link.status === "revoked") return err("This link has been revoked", 410);
    if (link.status === "expired") return err("This link has expired", 410);
    if (link.status === "used")    return err("This link has already been used", 410);

    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body", 400);

    let submittedRecordId: string | null = null;
    const formType: string = link.form_type;

    // ── Location Resolver: Map text names to DB UUIDs ─────────────────────────
    let resolvedCountryId: string | null = body.countryId ?? null;
    let resolvedStateId: string | null = body.stateProvinceId ?? null;
    let resolvedCityId: string | null = body.cityId ?? null;

    await withLocalPg(async (sql) => {
      // 1. Resolve Country
      const countryRaw = (body.country || body.countryName || "").trim();
      if (!resolvedCountryId && countryRaw) {
        const rows = await sql<any[]>`
          SELECT id FROM public.countries
          WHERE deleted_at IS NULL
            AND (
              name ILIKE ${countryRaw}
              OR iso2 ILIKE ${countryRaw}
              OR iso3 ILIKE ${countryRaw}
              OR name ILIKE ${'%' + countryRaw + '%'}
            )
          ORDER BY
            CASE WHEN name ILIKE ${countryRaw} THEN 1
                 WHEN iso2 ILIKE ${countryRaw} THEN 2
                 ELSE 3 END
          LIMIT 1
        `;
        if (rows.length > 0) {
          resolvedCountryId = rows[0].id;
        }
      }

      if (!resolvedCountryId && link.country_id) {
        resolvedCountryId = link.country_id;
      }

      // 2. Resolve State / Province
      const stateRaw = (body.stateProvince || body.stateName || "").trim();
      if (resolvedCountryId && !resolvedStateId && stateRaw) {
        const rows = await sql<any[]>`
          SELECT id FROM public.states_provinces
          WHERE deleted_at IS NULL
            AND country_id = ${resolvedCountryId}::uuid
            AND (
              name ILIKE ${stateRaw}
              OR code ILIKE ${stateRaw}
              OR name ILIKE ${'%' + stateRaw + '%'}
            )
          ORDER BY
            CASE WHEN name ILIKE ${stateRaw} THEN 1 ELSE 2 END
          LIMIT 1
        `;
        if (rows.length > 0) {
          resolvedStateId = rows[0].id;
        }
      }

      // 3. Resolve City
      const cityRaw = (body.city || body.cityName || "").trim();
      if (resolvedCountryId && !resolvedCityId && cityRaw) {
        const rows = await sql<any[]>`
          SELECT id FROM public.cities
          WHERE deleted_at IS NULL
            AND (country_id = ${resolvedCountryId}::uuid ${resolvedStateId ? sql`OR state_province_id = ${resolvedStateId}::uuid` : sql``})
            AND (
              name ILIKE ${cityRaw}
              OR code ILIKE ${cityRaw}
              OR name ILIKE ${'%' + cityRaw + '%'}
            )
          ORDER BY
            CASE WHEN name ILIKE ${cityRaw} THEN 1 ELSE 2 END
          LIMIT 1
        `;
        if (rows.length > 0) {
          resolvedCityId = rows[0].id;
        }
      }
    });

    // ── Build contacts array (Multi-Phone, Multi-WhatsApp, Email) ─────────────
    const contacts: Array<{ type: string; value: string; isPrimary?: boolean }> = Array.isArray(body.contacts) ? [...body.contacts] : [];
    
    if (body.mobiles && Array.isArray(body.mobiles)) {
      for (const m of body.mobiles) {
        const cleanM = typeof m === "string" ? m.trim() : "";
        if (cleanM && !contacts.some((c) => c.value === cleanM)) {
          contacts.push({ type: "Mobile", value: cleanM, isPrimary: contacts.length === 0 });
        }
      }
    }
    if (body.mobile && typeof body.mobile === "string") {
      const cleanM = body.mobile.trim();
      if (cleanM && !contacts.some((c) => c.value === cleanM)) {
        contacts.push({ type: "Mobile", value: cleanM, isPrimary: contacts.length === 0 });
      }
    }

    if (body.whatsapps && Array.isArray(body.whatsapps)) {
      for (const w of body.whatsapps) {
        const cleanW = typeof w === "string" ? w.trim() : "";
        if (cleanW && !contacts.some((c) => c.value === cleanW)) {
          contacts.push({ type: "WhatsApp", value: cleanW });
        }
      }
    }
    if (body.whatsapp && typeof body.whatsapp === "string") {
      const cleanW = body.whatsapp.trim();
      if (cleanW && !contacts.some((c) => c.value === cleanW)) {
        contacts.push({ type: "WhatsApp", value: cleanW });
      }
    }

    if (body.email && typeof body.email === "string") {
      const cleanE = body.email.trim();
      if (cleanE && !contacts.some((c) => c.value === cleanE)) {
        contacts.push({ type: "Email", value: cleanE });
      }
    }

    // ── Build registrations array (CNIC, Passport, etc.) ──────────────────────
    const registrations: Array<{ type: string; value: string }> = Array.isArray(body.registrations) ? [...body.registrations] : [];
    if (body.documents && Array.isArray(body.documents)) {
      for (const doc of body.documents) {
        if (doc && doc.type && doc.number && !registrations.some((r) => r.type === doc.type)) {
          registrations.push({ type: doc.type, value: String(doc.number).trim() });
        }
      }
    }

    const primaryMobile = contacts.find((c) => c.type === "Mobile")?.value ?? body.mobile ?? null;
    const primaryWhatsapp = contacts.find((c) => c.type === "WhatsApp")?.value ?? body.whatsapp ?? null;
    const primaryEmail = contacts.find((c) => c.type === "Email")?.value ?? body.email ?? null;
    const resolvedPhoto = body.photoUrl ?? body.photo ?? null;

    // ── Route to the correct service ──────────────────────────────────────────
    if (formType === "customer") {
      submittedRecordId = await customersService.create(
        {
          countryId:       resolvedCountryId ?? "",
          stateProvinceId: resolvedStateId ?? null,
          districtId:      body.districtId ?? null,
          cityId:          resolvedCityId ?? null,
          areaLocationId:  body.areaLocationId ?? null,
          customerName:    body.customerName ?? body.fullName ?? "Unknown",
          firstName:       body.firstName ?? null,
          lastName:        body.lastName ?? null,
          fatherName:      body.fatherName ?? null,
          gender:          body.gender ?? null,
          photoUrl:        resolvedPhoto,
          companyName:     body.companyName ?? null,
          contactPerson:   body.contactPerson ?? null,
          mobile:          primaryMobile,
          whatsapp:        primaryWhatsapp,
          email:           primaryEmail,
          address:         body.address ?? null,
          notes:           `[External Form Submission] ${body.notes ?? ""}`.trim(),
          originalLanguage: body.originalLanguage ?? "en",
          contacts,
          registrations,
        },
        null // no authenticated user
      );
    } else if (formType === "company") {
      submittedRecordId = await companiesService.create(
        {
          name:             body.name ?? body.companyName ?? "Unknown",
          legalName:        body.legalName ?? null,
          baseCurrency:     body.baseCurrency ?? "USD",
          originalLanguage: body.originalLanguage ?? "en",
          ownerName:        body.ownerName ?? null,
          ownerPersonId:    null,
          managerPersonId:  null,
          businessType:     body.businessType ?? null,
          countryId:        resolvedCountryId ?? null,
          countryBranchId:  body.countryBranchId ?? link.country_branch_id ?? null,
          cityBranchId:     body.cityBranchId ?? link.city_branch_id ?? null,
          isBranchOperative: false,
          stateProvinceId:  resolvedStateId ?? null,
          districtId:       body.districtId ?? null,
          cityId:           resolvedCityId ?? null,
          areaLocationId:   body.areaLocationId ?? null,
          countryName:      body.countryName ?? body.country ?? null,
          stateName:        body.stateName ?? body.stateProvince ?? null,
          districtName:     body.districtName ?? null,
          cityName:         body.cityName ?? body.city ?? null,
          areaName:         body.areaName ?? null,
          zipCode:          body.postalCode ?? body.zipCode ?? null,
          address:          body.address ?? null,
          contacts,
          registrations,
          ownerIds:         body.ownerIds ?? [],
        },
        null
      );
    } else if (formType === "employee" || formType === "agent") {
      await withLocalPg(async (sql) => {
        const [row] = await sql<any[]>`
          insert into pending_ext_submissions
            (form_type, form_link_token, submission_data, submitted_at, country_id)
          values
            (${formType}, ${token}, ${sql.json(body)}, now(), ${resolvedCountryId ?? link.country_id ?? null})
          returning id
        `.catch(async () => {
          await sql`
            create table if not exists pending_ext_submissions (
              id            uuid primary key default gen_random_uuid(),
              form_type     text not null,
              form_link_token text,
              submission_data jsonb,
              status        text not null default 'pending',
              submitted_at  timestamptz not null default now(),
              reviewed_by   uuid,
              reviewed_at   timestamptz,
              created_record_id uuid,
              country_id    uuid,
              notes         text
            )
          `;
          const [r2] = await sql<any[]>`
            insert into pending_ext_submissions
              (form_type, form_link_token, submission_data, submitted_at, country_id)
            values
              (${formType}, ${token}, ${sql.json(body)}, now(), ${resolvedCountryId ?? link.country_id ?? null})
            returning id
          `;
          return [r2];
        });
        submittedRecordId = row?.id ?? null;
      });
    } else {
      return err(`Unknown form type: ${formType}`, 400);
    }

    // ── Mark link as used ─────────────────────────────────────────────────────
    await withLocalPg(async (sql) => {
      await sql`
        update external_form_links
        set
          status               = 'used',
          submitted_at         = now(),
          submitted_record_id  = ${submittedRecordId},
          submission_data      = ${sql.json(body)},
          updated_at           = now()
        where token = ${token}
      `;
    });

    return ok({ submittedRecordId, formType }, 201);
  } catch (e: any) {
    console.error("[Public Form Link POST]", e);
    return err(e?.message ?? "Submission failed. Please try again.", 500);
  }
}
