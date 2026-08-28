import fs from 'fs';
import path from 'path';

// Collect all page.tsx in app/dashboard
function getPageRoutes(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes = new Set();
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.join(base, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('.')) {
        for (const r of getPageRoutes(full, rel)) routes.add(r);
      }
    } else if (e.name === 'page.tsx' || e.name === 'page.jsx' || e.name === 'page.js') {
      const url = '/dashboard' + (base ? '/' + base.replace(/\\/g, '/') : '');
      routes.add(url);
    }
  }
  return routes;
}

const existingDashboardRoutes = getPageRoutes('app/dashboard');
console.log('Existing Dashboard Routes Count:', existingDashboardRoutes.size);

// Search for all href: "/dashboard/..." in components and app
function extractHrefs(dir) {
  const hrefs = new Set();
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(full);
      } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
        const text = fs.readFileSync(full, 'utf8');
        const matches = text.matchAll(/["'](\/dashboard[^"'?#\s]*)["']/g);
        for (const m of matches) {
          hrefs.add({ href: m[1], file: full });
        }
      }
    }
  }
  walk(dir);
  return hrefs;
}

const foundHrefs = extractHrefs('components');
const appHrefs = extractHrefs('app');
const featHrefs = extractHrefs('features');

const allHrefs = [...foundHrefs, ...appHrefs, ...featHrefs];

const missing = [];
for (const item of allHrefs) {
  // Normalize if dynamic
  if (item.href.includes('[') || item.href.includes('${')) continue;
  if (!existingDashboardRoutes.has(item.href)) {
    // Check if it matches a dynamic pattern like /dashboard/users/[id]
    const parts = item.href.split('/');
    let matched = false;
    for (const r of existingDashboardRoutes) {
      const rParts = r.split('/');
      if (rParts.length === parts.length) {
        let ok = true;
        for (let i = 0; i < parts.length; i++) {
          if (rParts[i].startsWith('[') && rParts[i].endsWith(']')) continue;
          if (rParts[i] !== parts[i]) { ok = false; break; }
        }
        if (ok) { matched = true; break; }
      }
    }
    if (!matched) {
      missing.push(item);
    }
  }
}

console.log('Missing/Unmatched Dashboard Hrefs (' + missing.length + '):');
const uniqueMissing = new Map();
for (const m of missing) {
  if (!uniqueMissing.has(m.href)) {
    uniqueMissing.set(m.href, []);
  }
  uniqueMissing.get(m.href).push(m.file);
}

for (const [href, files] of uniqueMissing.entries()) {
  console.log(`- ${href} (referenced in: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''})`);
}
