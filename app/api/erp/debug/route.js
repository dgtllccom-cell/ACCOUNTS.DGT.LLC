import { NextResponse } from "next/server";
import { execSync } from "child_process";
export async function GET() {
  try {
    const output = execSync('git log -p -n 1 -- app/api/erp/purchases/orders/\\[id\\]/transfer/route.ts', { encoding: 'utf-8', cwd: 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC' });
    return NextResponse.json({ success: true, output });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
