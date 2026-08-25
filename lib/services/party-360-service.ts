import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";
import { nameMatches } from "@/lib/utils/person-duplicate-match";

export type PartyAffiliationSummary = {
  customerId?: string;
  customerCode?: string;
  customerName: string;
  fatherName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  mobile?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  countryName?: string | null;
  stateName?: string | null;
  cityName?: string | null;
  partyType?: string | null;
  
  // Cross-system affiliations
  companies: Array<{
    id: string;
    name: string;
    legalName?: string;
    businessType?: string;
    cityName?: string;
    countryName?: string;
    ownerName?: string;
  }>;
  
  employees: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    fatherName?: string;
    jobTitle?: string;
    department?: string;
    branchName?: string;
    status?: string;
  }>;
  
  banks: Array<{
    id: string;
    bankName: string;
    accountTitle?: string;
    accountNumber?: string;
    branchCode?: string;
    currency?: string;
    accountStatus?: string;
  }>;
  
  transactionsSummary: {
    totalEntries: number;
    latestEntryDate?: string | null;
  };
};

export class Party360Service {
  /**
   * Get 360-degree cross-module linkage summary for a specific party or name
   */
  async getParty360Summary(params: {
    customerId?: string;
    name?: string;
    employeeId?: string;
    lang?: string;
  }): Promise<PartyAffiliationSummary | null> {
    const { customerId, name, employeeId } = params;

    return await withLocalPg(async (sql) => {
      // 1. Fetch customer profile if customerId or name provided
      let customerRow: any = null;
      if (customerId) {
        const rows = await sql`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.customers c
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE c.id = ${customerId}::uuid
          LIMIT 1
        `;
        customerRow = rows[0] || null;
      }

      // If no customerRow yet, try searching by name or employeeId
      if (!customerRow && name) {
        const rows = await sql`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.customers c
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE LOWER(c.customer_name) = LOWER(${name}) OR LOWER(c.first_name || ' ' || COALESCE(c.last_name, '')) = LOWER(${name})
          LIMIT 1
        `;
        customerRow = rows[0] || null;
      }

      // If still no customerRow and only an employeeId was given, resolve the Person Master
      // via employees.person_master_id (NOT NULL FK) — lets an "ERP Links" entry point that
      // only knows the employee record still resolve back to the same shared person.
      if (!customerRow && !customerId && employeeId) {
        const rows = await sql`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.employees e
          JOIN public.customers c ON c.id = e.person_master_id
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE e.id = ${employeeId}::uuid
          LIMIT 1
        `;
        customerRow = rows[0] || null;
      }

      const resolvedCustomerId = customerId || customerRow?.id || null;
      const targetName = customerRow?.customer_name || name || "";

      // 2. Fetch all companies and match
      const allCompanies = await sql`
        SELECT c.id, c.name, c.legal_name, c.business_type, c.city_name, c.country_name, c.owner_name, c.owner_person_id
        FROM public.companies c
        ORDER BY c.name ASC
      `;

      const matchedCompanies = allCompanies.filter((comp: any) => {
        if (resolvedCustomerId && comp.owner_person_id === resolvedCustomerId) return true;
        return false;
      }).map((comp: any) => ({
        id: comp.id,
        name: comp.name || comp.legal_name || "Company",
        legalName: comp.legal_name,
        businessType: comp.business_type,
        cityName: comp.city_name,
        countryName: comp.country_name,
        ownerName: comp.owner_name
      }));

      // 3. Fetch all employees and match. person_master_id is NOT NULL on employees, so this
      // is always a reliable FK join — no fuzzy-name fallback needed for this entity type.
      const allEmployees = await sql`
        SELECT e.id, e.employee_code, e.person_master_id, e.designation, e.department, e.status, b.name AS branch_name,
               c.customer_name, c.first_name, c.last_name, c.father_name
        FROM public.employees e
        JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.country_branches b ON b.id = e.country_branch_id
        WHERE e.deleted_at IS NULL
        ORDER BY e.employee_code ASC
      `;

      const matchedEmployees = allEmployees.filter((emp: any) => {
        if (employeeId && emp.id === employeeId) return true;
        if (resolvedCustomerId && emp.person_master_id === resolvedCustomerId) return true;
        return false;
      }).map((emp: any) => ({
        id: emp.id,
        employeeCode: emp.employee_code || "EMP",
        fullName: emp.customer_name || [emp.first_name, emp.last_name].filter(Boolean).join(" "),
        fatherName: emp.father_name,
        jobTitle: emp.designation,
        department: emp.department,
        branchName: emp.branch_name,
        status: emp.status
      }));

      // 4. Fetch all banks and match
      const allBanks = await sql`
        SELECT b.id, b.bank_name, b.account_title, b.account_number, b.branch_code, b.currency, b.account_status
        FROM public.banks b
        WHERE b.deleted_at IS NULL
        ORDER BY b.bank_name ASC
      `;

      const matchedBanks = allBanks.filter((bnk: any) => {
        if (targetName && (nameMatches(bnk.account_title, targetName) || nameMatches(bnk.bank_name, targetName))) return true;
        return false;
      }).map((bnk: any) => ({
        id: bnk.id,
        bankName: bnk.bank_name,
        accountTitle: bnk.account_title,
        accountNumber: bnk.account_number,
        branchCode: bnk.branch_code,
        currency: bnk.currency,
        accountStatus: bnk.account_status
      }));

      // 5. Aggregate transaction counts if customerRow exists
      let totalEntries = 0;
      let latestEntryDate: string | null = null;
      if (customerRow?.id) {
        try {
          const entryCount = await sql`
            SELECT COUNT(*)::int AS count, MAX(created_at) AS max_date
            FROM public.daily_entries
            WHERE customer_id = ${customerRow.id}::uuid
          `;
          totalEntries = entryCount[0]?.count || 0;
          latestEntryDate = entryCount[0]?.max_date ? new Date(entryCount[0].max_date).toISOString() : null;
        } catch {}
      }

      return {
        customerId: customerRow?.id,
        customerCode: customerRow?.customer_code || (customerRow?.id ? `CUST-${customerRow.id.slice(0, 6).toUpperCase()}` : undefined),
        customerName: customerRow?.customer_name || targetName || "Unknown Party",
        fatherName: customerRow?.father_name || (matchedEmployees[0]?.fatherName) || null,
        firstName: customerRow?.first_name || null,
        lastName: customerRow?.last_name || null,
        gender: customerRow?.gender || null,
        mobile: customerRow?.mobile || null,
        phone: customerRow?.phone || null,
        whatsapp: customerRow?.whatsapp || null,
        email: customerRow?.email || null,
        address: customerRow?.address || null,
        countryName: customerRow?.country_name || null,
        stateName: customerRow?.state_name || null,
        cityName: customerRow?.city_name || null,
        partyType: customerRow?.party_type || (matchedCompanies.length > 0 ? "Owner" : matchedEmployees.length > 0 ? "Employee" : "Customer"),
        companies: matchedCompanies,
        employees: matchedEmployees,
        banks: matchedBanks,
        transactionsSummary: {
          totalEntries,
          latestEntryDate
        }
      };
    });
  }

  /**
   * Get Universal Directory of all parties with cross-system linkage counts
   */
  async getUniversalPartiesDirectory(params: {
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    parties: PartyAffiliationSummary[];
    total: number;
  }> {
    const { query = "", limit = 100, offset = 0 } = params;

    return await withLocalPg(async (sql) => {
      // 1. Load all active customers
      const customers = await sql`
        SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
        FROM public.customers c
        LEFT JOIN public.countries co ON co.id = c.country_id
        LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
        LEFT JOIN public.cities ci ON ci.id = c.city_id
        ORDER BY c.created_at DESC
        LIMIT 500
      `;

      // 2. Load all companies
      const companies = await sql`
        SELECT c.id, c.name, c.legal_name, c.business_type, c.city_name, c.country_name, c.owner_name, c.owner_person_id
        FROM public.companies c
      `;

      // 3. Load all employees (person_master_id is NOT NULL — reliable FK join, no fuzzy fallback)
      const employees = await sql`
        SELECT e.id, e.employee_code, e.person_master_id, e.designation, e.department, e.status, b.name AS branch_name,
               c.customer_name, c.first_name, c.last_name, c.father_name
        FROM public.employees e
        JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.country_branches b ON b.id = e.country_branch_id
        WHERE e.deleted_at IS NULL
      `;

      // 4. Load all banks
      const banks = await sql`
        SELECT b.id, b.bank_name, b.account_title, b.account_number, b.branch_code, b.currency, b.account_status
        FROM public.banks b
        WHERE b.deleted_at IS NULL
      `;

      // Build unified parties list
      const parties: PartyAffiliationSummary[] = [];

      for (const cust of customers) {
        const cName = cust.customer_name || [cust.first_name, cust.last_name].filter(Boolean).join(" ");
        
        const matchedCompanies = companies.filter((comp: any) => {
          if (comp.owner_person_id && comp.owner_person_id === cust.id) return true;
          return false;
        }).map((comp: any) => ({
          id: comp.id,
          name: comp.name || comp.legal_name || "Company",
          legalName: comp.legal_name,
          businessType: comp.business_type,
          cityName: comp.city_name,
          countryName: comp.country_name,
          ownerName: comp.owner_name
        }));

        const matchedEmployees = employees.filter((emp: any) => {
          if (emp.person_master_id && emp.person_master_id === cust.id) return true;
          return false;
        }).map((emp: any) => ({
          id: emp.id,
          employeeCode: emp.employee_code || "EMP",
          fullName: emp.customer_name || [emp.first_name, emp.last_name].filter(Boolean).join(" "),
          fatherName: emp.father_name,
          jobTitle: emp.designation,
          department: emp.department,
          branchName: emp.branch_name,
          status: emp.status
        }));

        const matchedBanks = banks.filter((bnk: any) => {
          if (cName && (nameMatches(bnk.account_title, cName) || nameMatches(bnk.bank_name, cName))) return true;
          return false;
        }).map((bnk: any) => ({
          id: bnk.id,
          bankName: bnk.bank_name,
          accountTitle: bnk.account_title,
          accountNumber: bnk.account_number,
          branchCode: bnk.branch_code,
          currency: bnk.currency,
          accountStatus: bnk.account_status
        }));

        parties.push({
          customerId: cust.id,
          customerCode: cust.customer_code || `CUST-${cust.id.slice(0, 6).toUpperCase()}`,
          customerName: cName,
          fatherName: cust.father_name || matchedEmployees[0]?.fatherName || null,
          firstName: cust.first_name || null,
          lastName: cust.last_name || null,
          gender: cust.gender || null,
          mobile: cust.mobile || null,
          phone: cust.phone || null,
          whatsapp: cust.whatsapp || null,
          email: cust.email || null,
          address: cust.address || null,
          countryName: cust.country_name || null,
          stateName: cust.state_name || null,
          cityName: cust.city_name || null,
          partyType: cust.party_type || (matchedCompanies.length > 0 ? "Owner" : matchedEmployees.length > 0 ? "Employee" : "Customer"),
          companies: matchedCompanies,
          employees: matchedEmployees,
          banks: matchedBanks,
          transactionsSummary: {
            totalEntries: 0
          }
        });
      }

      // Filter by query
      let filtered = parties;
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        filtered = parties.filter((p) => {
          const haystack = [
            p.customerName,
            p.customerCode || "",
            p.fatherName || "",
            p.mobile || "",
            p.email || "",
            p.cityName || "",
            p.countryName || "",
            ...p.companies.map(c => c.name),
            ...p.employees.map(e => e.employeeCode)
          ].join(" ").toLowerCase();
          return haystack.includes(q);
        });
      }

      const paged = filtered.slice(offset, offset + limit);

      return {
        parties: paged,
        total: filtered.length
      };
    });
  }
}

export const party360Service = new Party360Service();
