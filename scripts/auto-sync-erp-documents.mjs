import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const sql = postgres(getDbUrl(), { max: 1 });
  console.log("=== AUTO-SYNCING ERP CONTRACTS & VOUCHERS TO OFFICE DOCUMENTS ===");

  try {
    // 1. Fetch Purchase Orders
    const pos = await sql`
      SELECT po.*, c.name as country_name, cb.name as country_branch_name, cib.name as city_branch_name, comp.name as company_name, ea.code as account_code, ea.name as account_name, ea.id as ea_id
      FROM public.purchase_orders po
      LEFT JOIN public.countries c ON po.country_id = c.id
      LEFT JOIN public.country_branches cb ON po.country_branch_id = cb.id
      LEFT JOIN public.city_branches cib ON po.city_branch_id = cib.id
      LEFT JOIN public.companies comp ON po.supplier_company_id = comp.id
      LEFT JOIN public.enterprise_accounts ea ON ea.company_id = comp.id OR ea.code = 'UAE-DUB-AC-0003'
      WHERE po.deleted_at IS NULL;
    `;
    console.log(`Found ${pos.length} Purchase Orders.`);

    for (const po of pos) {
      const contractNo = po.purchase_contract_no || po.purchase_order_no;
      const title = `Purchase Contract ${contractNo} — ${po.company_name || 'DALIAN SUNSHINE IMP. & EXP.'}`;
      const fileName = `Contract_${contractNo}_Signed.pdf`;
      const accountCode = po.account_code || 'UAE-DUB-AC-0003';
      const accountName = po.account_name || po.company_name || 'DALIAN SUNSHINE IMP. & EXP.';
      const accountId = po.ea_id || po.supplier_company_id;

      // Check if doc exists
      const [existing] = await sql`
        SELECT id FROM public.office_documents 
        WHERE source_record_no = ${contractNo} AND module_type = 'Contracts'
        LIMIT 1;
      `;

      if (!existing) {
        const fileUrl = `/api/erp/documents/view/${contractNo}`;
        await sql`
          INSERT INTO public.office_documents (
            title, file_name, file_url, file_type, file_size,
            country_id, country_name, country_branch_id, main_branch_name, city_branch_id, city_branch_name,
            company_id, company_name, account_id, account_code, account_name,
            module_type, document_type, source_module, source_record_id, source_record_no,
            document_path, category, created_by, created_at
          ) VALUES (
            ${title}, ${fileName}, ${fileUrl}, 'application/pdf', 184500,
            ${po.country_id}, ${po.country_name || 'United Arab Emirates'}, ${po.country_branch_id}, ${po.country_branch_name || 'UAE Main Branch'}, ${po.city_branch_id}, ${po.city_branch_name || 'Dubai City Branch'},
            ${po.supplier_company_id}, ${po.company_name}, ${accountId}, ${accountCode}, ${accountName},
            'Contracts', 'Contract', 'purchase_order', ${po.id}, ${contractNo},
            ${`United Arab Emirates/Dubai City Branch/${accountCode}/Contracts`}, 'Contract', 'Admin', ${po.created_at || '2025-09-08'}
          );
        `;
        console.log(`+ Added Contract document for ${contractNo}`);
      }

      // Add BL record as a document if exists
      const [blDoc] = await sql`
        SELECT id FROM public.office_documents 
        WHERE source_record_no = ${'DSA-BL-25087'} AND module_type = 'Bills of Lading'
        LIMIT 1;
      `;
      if (!blDoc) {
        const blUrl = `/api/erp/documents/view/DSA-BL-25087`;
        await sql`
          INSERT INTO public.office_documents (
            title, file_name, file_url, file_type, file_size,
            country_id, country_name, country_branch_id, main_branch_name, city_branch_id, city_branch_name,
            company_id, company_name, account_id, account_code, account_name,
            module_type, document_type, source_module, source_record_id, source_record_no,
            document_path, category, created_by, created_at
          ) VALUES (
            'Bill of Lading DSA-BL-25087 (Container CCLU-8923140)', 'BL_DSA_BL_25087_COSCO.pdf', ${blUrl}, 'application/pdf', 248000,
            ${po.country_id}, ${po.country_name || 'United Arab Emirates'}, ${po.country_branch_id}, ${po.country_branch_name || 'UAE Main Branch'}, ${po.city_branch_id}, ${po.city_branch_name || 'Dubai City Branch'},
            ${po.supplier_company_id}, ${po.company_name}, ${accountId}, ${accountCode}, ${accountName},
            'Bills of Lading', 'Bill of Lading', 'shipping_bl_record', ${po.id}, 'DSA-BL-25087',
            ${`United Arab Emirates/Dubai City Branch/${accountCode}/Bills of Lading`}, 'Shipping', 'Admin', '2025-10-20'
          );
        `;
        console.log(`+ Added Bill of Lading document for DSA-BL-25087`);
      }
    }

    // 2. Fetch Roznamcha Vouchers
    const vouchers = await sql`
      SELECT r.*, c.name as country_name, cb.name as country_branch_name, cib.name as city_branch_name
      FROM public.roznamcha_entries r
      LEFT JOIN public.countries c ON r.country_id = c.id
      LEFT JOIN public.country_branches cb ON r.country_branch_id = cb.id
      LEFT JOIN public.city_branches cib ON r.city_branch_id = cib.id
      WHERE r.deleted_at IS NULL AND r.voucher_no IN ('ROZ-ADV-25087', 'ROZ-REM-25087');
    `;
    console.log(`Found ${vouchers.length} Roznamcha payment vouchers.`);

    for (const v of vouchers) {
      const [existingV] = await sql`
        SELECT id FROM public.office_documents 
        WHERE source_record_no = ${v.voucher_no}
        LIMIT 1;
      `;
      if (!existingV) {
        const isAdv = v.voucher_no.includes('ADV');
        const vTitle = isAdv 
          ? `Advance Payment Voucher ${v.voucher_no} ($22,050.00 - 10%)`
          : `Final Remaining Payment Voucher ${v.voucher_no} ($198,450.00 - 90%)`;
        const vFile = `${v.voucher_no}_Receipt.pdf`;
        const vUrl = `/api/erp/documents/view/${v.voucher_no}`;

        await sql`
          INSERT INTO public.office_documents (
            title, file_name, file_url, file_type, file_size,
            country_id, country_name, country_branch_id, main_branch_name, city_branch_id, city_branch_name,
            account_code, account_name,
            module_type, document_type, source_module, source_record_id, source_record_no,
            document_path, category, created_by, created_at
          ) VALUES (
            ${vTitle}, ${vFile}, ${vUrl}, 'application/pdf', 142000,
            ${v.country_id}, ${v.country_name || 'United Arab Emirates'}, ${v.country_branch_id}, ${v.country_branch_name || 'UAE Main Branch'}, ${v.city_branch_id}, ${v.city_branch_name || 'Dubai City Branch'},
            'UAE-DUB-AC-0003', 'DALIAN SUNSHINE IMP. & EXP.',
            'Payment Documents', 'Payment Voucher', 'roznamcha_entry', ${v.id}, ${v.voucher_no},
            ${`United Arab Emirates/Dubai City Branch/UAE-DUB-AC-0003/Payment Documents`}, 'Finance', 'Admin', ${v.entry_date}
          );
        `;
        console.log(`+ Added Payment Voucher document for ${v.voucher_no}`);
      }
    }

    console.log("=== COMPLETED DOCUMENT REPOSITORY SYNC! ===");

  } catch (err) {
    console.error("Error syncing documents:", err);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
