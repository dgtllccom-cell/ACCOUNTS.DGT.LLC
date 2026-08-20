import fs from 'fs';
import path from 'path';

function findFiles(dir, matchExt, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', '.tmp', 'dist'].includes(f)) {
        findFiles(full, matchExt, fileList);
      }
    } else if (matchExt.some(ext => f.endsWith(ext))) {
      fileList.push(full);
    }
  }
  return fileList;
}

function auditFrontend() {
  console.log('--- 1. AUDITING ROUTES & APP PAGES ---');
  const pageFiles = findFiles('app', ['page.tsx', 'page.jsx', 'route.ts', 'route.js']);
  const appPages = pageFiles.filter(f => f.endsWith('page.tsx') || f.endsWith('page.jsx'));
  const apiRoutes = pageFiles.filter(f => f.endsWith('route.ts') || f.endsWith('route.js'));

  console.log(`Total App Pages: ${appPages.length}`);
  console.log(`Total API Routes: ${apiRoutes.length}`);

  // List all forms across features
  console.log('\n--- 2. AUDITING FORMS & MANAGEMENT VIEWS ---');
  const componentFiles = findFiles('features', ['.tsx', '.jsx']);
  const formComponents = componentFiles.filter(f => {
    const name = path.basename(f).toLowerCase();
    return name.includes('form') || name.includes('view') || name.includes('dialog') || name.includes('modal') || name.includes('entry');
  });
  console.log(`Total Form & Management View Components: ${formComponents.length}`);

  // Print & PDF Components
  console.log('\n--- 3. AUDITING PRINT & PDF TEMPLATES ---');
  const printComponents = componentFiles.filter(f => {
    const name = path.basename(f).toLowerCase();
    return name.includes('print') || name.includes('pdf') || name.includes('report') || name.includes('voucher') || name.includes('statement') || name.includes('invoice') || name.includes('a4');
  });
  console.log(`Total Print & Report Templates: ${printComponents.length}`);

  // Translation Dictionaries
  console.log('\n--- 4. AUDITING TRANSLATIONS & 5-LANGUAGE COVERAGE ---');
  const i18nFiles = findFiles('lib/i18n', ['.ts', '.json', '.js']);
  console.log(`Translation Files Found: ${i18nFiles.length}`);

  const auditReport = {
    totalAppPages: appPages.length,
    pagesList: appPages.map(p => p.replace(/\\/g, '/')),
    totalApiRoutes: apiRoutes.length,
    apiRoutesList: apiRoutes.map(p => p.replace(/\\/g, '/')),
    totalForms: formComponents.length,
    formsList: formComponents.map(p => p.replace(/\\/g, '/')),
    totalPrintComponents: printComponents.length,
    printComponentsList: printComponents.map(p => p.replace(/\\/g, '/')),
    i18nFiles: i18nFiles.map(p => p.replace(/\\/g, '/'))
  };

  fs.writeFileSync('scripts/audit-frontend-inventory.json', JSON.stringify(auditReport, null, 2));
  console.log('Frontend inventory saved to scripts/audit-frontend-inventory.json');
}

auditFrontend();
