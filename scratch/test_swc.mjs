import fs from 'fs';
import path from 'path';
import { parseSync } from '@swc/core';

const file = 'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/features/purchases/components/purchase-loading-records-view.tsx';
const code = fs.readFileSync(file, 'utf8');

try {
  parseSync(code, {
    syntax: 'typescript',
    tsx: true,
    jsx: true
  });
  console.log('✅ purchase-loading-records-view.tsx SWC PARSE SUCCESSFUL!');
} catch (err) {
  console.error('❌ SWC PARSE ERROR:', err.message);
}
