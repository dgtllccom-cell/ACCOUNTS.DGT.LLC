import { spawnSync } from 'child_process';

const testScript = `
import fs from 'fs';
import path from 'path';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      if (file === 'route.ts' || file === 'route.js') {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allApiRoutes = getFiles('/var/www/dgt-nextjs/app/api');
console.log('Total API routes found:', allApiRoutes.length);

async function testApiRoutes() {
  const results = { ok: [], redirect: [], notFound: [], serverError: [], clientError: [] };
  
  for (const f of allApiRoutes) {
    let urlPath = f.replace('/var/www/dgt-nextjs/app', '').replace('/route.ts', '').replace('/route.js', '');
    if (urlPath.includes('[') || urlPath.includes('(')) continue; // skip dynamic routes for now

    try {
      const res = await fetch('http://127.0.0.1:3000' + urlPath, { redirect: 'manual' });
      const status = res.status;
      if (status === 200) results.ok.push(urlPath);
      else if (status >= 300 && status < 400) results.redirect.push({ urlPath, status });
      else if (status === 404) results.notFound.push(urlPath);
      else if (status >= 500) results.serverError.push({ urlPath, status });
      else results.clientError.push({ urlPath, status });
    } catch (e) {
      results.serverError.push({ urlPath, error: e.message });
    }
  }

  console.log('Results summary for API routes (unauthenticated GET):');
  console.log('OK (200):', results.ok.length);
  console.log('Redirects (3xx):', results.redirect.length);
  console.log('Not Found (404):', results.notFound.length, results.notFound);
  console.log('Client Error (4xx):', results.clientError.length);
  console.log('Server Error (5xx):', results.serverError.length, results.serverError);
}

testApiRoutes();
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'node --input-type=module -'], {
  input: testScript,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
