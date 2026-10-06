import { chromium } from '@playwright/test';
import fs from 'node:fs';

async function testEdge() {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let execPath = edgePaths.find(p => fs.existsSync(p));
  console.log('Found browser executable at:', execPath);

  const browser = await chromium.launch({ 
    executablePath: execPath,
    headless: true 
  });
  const page = await browser.newPage();
  await page.setContent('<h1>Test PDF generated with Edge</h1>');
  await page.pdf({ path: 'test_edge.pdf', format: 'A4' });
  await browser.close();
  console.log('PDF generated successfully with system browser!');
}

testEdge().catch(console.error);
