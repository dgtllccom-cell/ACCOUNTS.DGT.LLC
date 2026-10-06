import http from 'http';

function checkEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://72.60.209.121${path}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ path, status: res.statusCode, dataLength: data.length });
      });
    });
    req.on('error', (err) => {
      resolve({ path, status: 'ERROR', error: err.message });
    });
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ path, status: 'TIMEOUT' });
    });
  });
}

async function main() {
  console.log("=== VERIFYING LIVE PRODUCTION ERP (72.60.209.121) ===\n");
  const endpoints = [
    '/',
    '/dashboard',
    '/dashboard/clearing-agent/customer-orders',
    '/dashboard/shipping-line',
    '/dashboard/roznamcha/super-admin',
    '/dashboard/sales/sales-booking-journal-report',
    '/dashboard/journal/ledger-report',
    '/api/erp/locations/countries',
    '/api/erp/branches/tree',
    '/api/erp/banks'
  ];

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    console.log(`[LIVE TEST] ${ep.padEnd(45)} => Status: ${res.status}, Length: ${res.dataLength || 0} bytes`);
  }
}

main().catch(console.error);
