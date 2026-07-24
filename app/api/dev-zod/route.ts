import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const content = fs.readFileSync('c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/lib/api/erp-validation.ts', 'utf8');
    const lines = content.split('\n');
    let results = [];
    lines.forEach((line, i) => {
        if (line.includes('purchaseOrderCreateSchema')) {
            results.push(`${i+1}: ${line.trim()}`);
        }
    });
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
