import fs from 'node:fs';
import path from 'node:path';

const dirs = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'public', 'reports'),
  path.join(process.cwd(), 'reports')
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const files = [
  'COMPLETE_ERP_SYSTEM_HANDOVER_REPORT.pdf',
  'COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf'
];

for (const f of files) {
  const rootFile = path.join(process.cwd(), f);
  const publicFile = path.join(process.cwd(), 'public', f);
  const publicReportsFile = path.join(process.cwd(), 'public', 'reports', f);
  const reportsFile = path.join(process.cwd(), 'reports', f);

  const source = [rootFile, publicFile, publicReportsFile, reportsFile].find(p => fs.existsSync(p));
  if (source) {
    [rootFile, publicFile, publicReportsFile, reportsFile].forEach(dest => {
      if (source !== dest) {
        try { fs.copyFileSync(source, dest); } catch (e) {}
      }
    });
    console.log(`✅ Synced ${f} across all report paths.`);
  } else {
    console.warn(`⚠️ Source file ${f} not found.`);
  }
}

