import http from 'http';

function queryRoute(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://72.60.209.121${path}`, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ path, status: res.statusCode, location: res.headers.location, bodySnippet: body.slice(0, 100) });
      });
    });
    req.on('error', (err) => resolve({ path, error: err.message }));
  });
}

async function test() {
  const routes = [
    '/',
    '/api/erp/locations/countries',
    '/dashboard/clearing-agent/customer-order',
    '/dashboard/clearing-agent/transit-entry',
    '/dashboard/shipping-line/shipment-report',
    '/dashboard/roznamcha/super-admin',
    '/dashboard/accounts/reports',
    '/dashboard/accounts/general-report'
  ];

  for (const r of routes) {
    const res = await queryRoute(r);
    console.log(`Endpoint: ${r.padEnd(45)} -> Status: ${res.status} ${res.location ? `(Redirect to: ${res.location})` : ''}`);
  }
}

test();
