/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Public API: /api/public/form-link/[token]
 *
 * No authentication required — this is called by the external form page
 * opened by recipients who have NOT logged in to the ERP.
 *
 * GET  → Validates token, returns form_type and metadata
 * POST → Accepts form data, creates the record in the ERP via existing
 *        service functions, marks the link as "used"
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
    if (link.status === "used")    return err("This link has already been used", 410);

    return ok({
      formType:       link.form_type,
      status:         link.status,
      createdByName:  link.created_by_name ?? null,
      expiresAt:      link.expires_at ?? null,
      notes:          link.notes ?? null,
    });
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

    // ── Route to the correct service ──────────────────────────────────────────
    const formType: string = link.form_type;

    if (formType === "customer") {
      submittedRecordId = await customersService.create(
        {
          countryId:       body.countryId ?? link.country_id ?? "",
          stateProvinceId: body.stateProvinceId ?? null,
          districtId:      body.districtId ?? null,
          cityId:          body.cityId ?? null,
          areaLocationId:  body.areaLocationId ?? null,
          customerName:    body.customerName ?? body.fullName ?? "Unknown",
          firstName:       body.firstName ?? null,
          lastName:        body.lastName ?? null,
          fatherName:      body.fatherName ?? null,
          gender:          body.gender ?? null,
          photoUrl:        body.photoUrl ?? null,
          companyName:     body.companyName ?? null,
          contactPerson:   body.contactPerson ?? null,
          mobile:          body.mobile ?? null,
          whatsapp:        body.whatsapp ?? null,
          email:           body.email ?? null,
          address:         body.address ?? null,
          notes:           `[External Form Submission] ${body.notes ?? ""}`.trim(),
          originalLanguage: body.originalLanguage ?? "en",
          contacts:        body.contacts ?? [],
          registrations:   body.registrations ?? [],
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
          countryId:        body.countryId ?? link.country_id ?? null,
          countryBranchId:  body.countryBranchId ?? link.country_branch_id ?? null,
          cityBranchId:     body.cityBranchId ?? link.city_branch_id ?? null,
          isBranchOperative: false,
          stateProvinceId:  body.stateProvinceId ?? null,
          districtId:       body.districtId ?? null,
          cityId:           body.cityId ?? null,
          areaLocationId:   body.areaLocationId ?? null,
          countryName:      body.countryName ?? null,
          stateName:        body.stateName ?? null,
          districtName:     body.districtName ?? null,
          cityName:         body.cityName ?? null,
          areaName:         body.areaName ?? null,
          zipCode:          body.zipCode ?? null,
          address:          body.address ?? null,
          contacts:         body.contacts ?? [],
          registrations:    body.registrations ?? [],
          ownerIds:         body.ownerIds ?? [],
        },
        null
      );
    } else if (formType === "employee" || formType === "agent") {
      // For employee & agent: insert into pending_ext_submissions and
      // let ERP staff review/approve. This avoids bypassing the richer
      // employee form validations that require HR context.
      await withLocalPg(async (sql) => {
        const [row] = await sql<any[]>`
          insert into pending_ext_submissions
            (form_type, form_link_token, submission_data, submitted_at, country_id)
          values
            (${formType}, ${token}, ${sql.json(body)}, now(), ${link.country_id ?? null})
          returning id
        `.catch(async () => {
          // Table may not exist yet — create it on-the-fly and retry
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
              (${formType}, ${token}, ${sql.json(body)}, now(), ${link.country_id ?? null})
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
