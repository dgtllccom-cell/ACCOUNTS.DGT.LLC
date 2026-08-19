import { spawnSync } from 'child_process';

const testScript = `
import fs from 'fs';
import path from 'path';

// Let us find all page.tsx and route.ts in app/dashboard
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      if (file === 'page.tsx' || file === 'route.ts') {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allRoutes = getFiles('/var/www/dgt-nextjs/app/dashboard');
console.log('Total dashboard routes/pages found:', allRoutes.length);

// Let us test curl against Next.js for a sample of these routes
async function testRoutes() {
  const results = { ok: [], redirect: [], notFound: [], error: [] };
  
  for (const f of allRoutes) {
    let urlPath = f.replace('/var/www/dgt-nextjs/app', '').replace('/page.tsx', '').replace('/route.ts', '');
    if (urlPath.includes('[') || urlPath.includes('(')) continue; // skip dynamic/grouped for quick check
    if (!urlPath) urlPath = '/';

    try {
      const res = await fetch('http://127.0.0.1:3000' + urlPath, { redirect: 'manual' });
      const status = res.status;
      if (status === 200) results.ok.push(urlPath);
      else if (status >= 300 && status < 400) results.redirect.push({ urlPath, status, loc: res.headers.get('location') });
      else if (status === 404) results.notFound.push(urlPath);
      else results.error.push({ urlPath, status });
    } catch (e) {
      results.error.push({ urlPath, error: e.message });
    }
  }

  console.log('Results summary:');
  console.log('OK (200):', results.ok.length);
  console.log('Redirects (3xx):', results.redirect.length);
  console.log('Not Found (404):', results.notFound.length, results.notFound);
  console.log('Errors (5xx):', results.error.length, results.error);
}

testRoutes();
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'node --input-type=module -'], {
  input: testScript,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
