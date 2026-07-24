import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  try {
    const file = fs.readFileSync('c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\features\\ledger\\components\\ledger-report-view.tsx', 'utf8');
    const lines = file.split('\n');
    let out = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('DR') || lines[i].includes('CR')) {
        out.push(`${i + 1}: ${lines[i].trim()}`);
      }
    }
    return NextResponse.json({ result: out });
  } catch (e) {
    return NextResponse.json({ error: e.message });
  }
}
