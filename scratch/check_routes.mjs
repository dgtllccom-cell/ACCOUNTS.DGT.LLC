import fs from 'fs';
import path from 'path';

function checkAllHrefs() {
  const filesToCheck = [
    'lib/navigation/sidebar.ts',
    'components/layout/dashboard-frame.tsx',
    'features/reports/components/system-audit-and-forms-directory.tsx',
    'lib/permissions/enterprise-roles.ts'
  ];

  const allHrefs = new Set();

  for (const rel of filesToCheck) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const matches = content.match(/href:\s*["']([^"']+)["']/g) || [];
    for (const m of matches) {
      const url = m.replace(/href:\s*["']/, '').slice(0, -1);
      allHrefs.add(url);
    }
    const routeMatches = content.match(/route:\s*["']([^"']+)["']/g) || [];
    for (const m of routeMatches) {
      const url = m.replace(/route:\s*["']/, '').slice(0, -1);
      allHrefs.add(url);
    }
    const dashboardMatches = content.match(/"\/dashboard\/[^"]+"/g) || [];
    for (const m of dashboardMatches) {
      allHrefs.add(m.slice(1, -1));
    }
  }

  const missing = [];
  for (const href of allHrefs) {
    const cleanPath = href.split('?')[0].split('#')[0];
    if (!cleanPath.startsWith('/dashboard')) continue;
    
    // Check if dynamic route or static
    const relPath = cleanPath.slice(1);
    const pageTsx = path.join(process.cwd(), 'app', relPath, 'page.tsx');
    const pageJsx = path.join(process.cwd(), 'app', relPath, 'page.jsx');
    const routeTs = path.join(process.cwd(), 'app', relPath, 'route.ts');
    
    if (!fs.existsSync(pageTsx) && !fs.existsSync(pageJsx) && !fs.existsSync(routeTs)) {
      missing.push({ href, cleanPath });
    }
  }

  console.log('Checked Hrefs Count:', allHrefs.size);
  console.log('Missing Routes:', missing);
}

checkAllHrefs();
