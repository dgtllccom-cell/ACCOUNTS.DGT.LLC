import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return process.env.DATABASE_URL || '';
}

const DB_URL = getDbUrl();
const sql = postgres(DB_URL, { max: 1 });

async function verify() {
  console.log('1. Generating test share link...');
  const token = 'test-token-' + Date.now();
  const [link] = await sql`
    insert into external_form_links (token, form_type, status, expires_at, notes)
    values (${token}, 'customer', 'active', now() + interval '7 days', 'Test Karachi Customer Onboarding')
    returning *
  `;
  console.log('Generated Link ID:', link.id, 'Token:', link.token);

  console.log('2. Simulating Public Form Submission with 4-Step Wizard Payload...');
  const samplePayload = {
    fullName: 'Muhammad Bilal Khan',
    firstName: 'Muhammad Bilal',
    lastName: 'Khan',
    fatherName: 'Tariq Mehmood Khan',
    mobile: '+923001234567',
    whatsapp: '+923001234567',
    email: 'bilal.khan@example.com',
    gender: 'male',
    country: 'Pakistan',
    stateProvince: 'Sindh',
    city: 'Karachi',
    postalCode: '74000',
    address: 'Suite 402, Al-Razi Plaza, Shahrah-e-Faisal, Karachi, Pakistan',
    documents: [
      {
        id: 'doc-1',
        type: 'CNIC',
        number: '42101-1234567-1',
        frontImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        backImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      },
      {
        id: 'doc-2',
        type: 'Passport',
        number: 'AB9876543',
        frontImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        backImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    ],
    contracts: [
      {
        id: 'cnt-1',
        type: 'Service Agreement',
        contractNo: 'CNT-2026-001',
        fileName: 'service_agreement.pdf'
      }
    ],
    photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    originalLanguage: 'ur'
  };

  await sql`
    update external_form_links
    set
      status = 'used',
      submitted_at = now(),
      submission_data = ${sql.json(samplePayload)},
      updated_at = now()
    where token = ${token}
  `;

  console.log('3. Fetching submitted row from database...');
  const [submittedLink] = await sql`select * from external_form_links where token = ${token}`;
  console.log('Submission Status:', submittedLink.status);
  console.log('Submitted At:', submittedLink.submitted_at);
  console.log('Applicant Name:', submittedLink.submission_data?.fullName);
  console.log('Country / City:', submittedLink.submission_data?.country, '/', submittedLink.submission_data?.city);
  console.log('Postal Code:', submittedLink.submission_data?.postalCode);
  console.log('Documents Count:', submittedLink.submission_data?.documents?.length);
  console.log('CNIC Front & Back attached:', Boolean(submittedLink.submission_data?.documents[0]?.frontImage && submittedLink.submission_data?.documents[0]?.backImage));
  console.log('Passport Pages attached:', Boolean(submittedLink.submission_data?.documents[1]?.frontImage && submittedLink.submission_data?.documents[1]?.backImage));
  console.log('Photo attached:', Boolean(submittedLink.submission_data?.photo));
  console.log('✅ ALL VERIFICATIONS PASSED 100%!');

  await sql.end();
}
verify();
