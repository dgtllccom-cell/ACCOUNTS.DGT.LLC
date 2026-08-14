import fs from 'node:fs';
import path from 'node:path';

const publicReportsDir = path.join(process.cwd(), 'public', 'reports');
if (!fs.existsSync(publicReportsDir)) {
  fs.mkdirSync(publicReportsDir, { recursive: true });
}

const srcPdf = path.join(process.cwd(), 'COMPLETE_ERP_SYSTEM_HANDOVER_REPORT.pdf');
const destPdf = path.join(publicReportsDir, 'COMPLETE_ERP_SYSTEM_HANDOVER_REPORT.pdf');

if (fs.existsSync(srcPdf)) {
  fs.copyFileSync(srcPdf, destPdf);
  console.log('✅ Copied PDF to public/reports/COMPLETE_ERP_SYSTEM_HANDOVER_REPORT.pdf');
} else {
  console.error('Source PDF not found at', srcPdf);
}
