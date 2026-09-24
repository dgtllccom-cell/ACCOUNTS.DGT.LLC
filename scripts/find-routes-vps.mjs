try {
  const res = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cat /var/www/dgt-nextjs/app/dashboard/roznamcha/cash-entry/page.tsx"`, { encoding: 'utf8' });
  console.log(res);
} catch (e) {
  console.error(e.message);
}
  headers: {
    'Cookie': 'erp_session=' + token + '; erp_lang=en'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HTML SNIPPET:', data.slice(0, 1000));
  });
});
req.end();
`;
const b64 = Buffer.from(script).toString('base64');
const res = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "echo '${b64}' | base64 -d > /tmp/check_html.js ; node /tmp/check_html.js"`, { encoding: 'utf8' });
console.log(res);
