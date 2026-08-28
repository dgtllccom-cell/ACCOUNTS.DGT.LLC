import http from 'http';

function testLogin(identifier, password) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ identifier, password });
    const req = http.request('http://72.60.209.121/api/erp/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Login [${identifier}]: Status ${res.statusCode} -> ${body}`);
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error(`Login [${identifier}] Error:`, err.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Standardized City & Branch Logins ---');
  await testLogin('quetta@dgt.llc', 'Admin@123');
  await testLogin('chaman@dgt.llc', 'Admin@123');
  await testLogin('chaman01@dgt.llc', 'Admin@123');
  await testLogin('kandahar@dgt.llc', 'Admin@123');
  await testLogin('alras@dgt.llc', 'Admin@123');
  await testLogin('superadmin', 'Admin@123');
  console.log('--- Finished Testing ---');
}

run();
