import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const admin = createSupabaseAdminClient() as any;
    
    // Find recent cash entries with exactly 2 lines
    const { data: roznamchas, error: fetchError } = await admin
      .from('roznamchas')
      .select('id, roznamcha_lines(id, ledger_id, debit, credit)')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message });
    }
    
    const fixes = [];
    
    for (const roz of roznamchas) {
      if (roz.roznamcha_lines && roz.roznamcha_lines.length === 2) {
        // Find the line that represents the Cash/Bank ledger.
        const l1 = roz.roznamcha_lines[0].ledger_id;
        const l2 = roz.roznamcha_lines[1].ledger_id;
        
        // Remove the join to accounts because it might fail. Just use name.
        const { data: ledgers, error: ledgersError } = await admin.from('ledgers').select('id, name').in('id', [l1, l2]);
        
        if (ledgersError) {
           return NextResponse.json({ error: ledgersError.message, l1, l2 });
        }
        
        if (ledgers && ledgers.length === 2) {
          const cashLedger = ledgers.find((l: any) => 
            l.name.toLowerCase().includes('cash') || 
            l.name.toLowerCase().includes('bank')
          );
          
          let lineToDelete = null;
          
          if (cashLedger) {
            lineToDelete = roz.roznamcha_lines.find((l: any) => l.ledger_id === cashLedger.id);
          } else {
             lineToDelete = roz.roznamcha_lines[1];
          }
          
          if (lineToDelete) {
             const { error: delError } = await admin.from('roznamcha_lines').delete().eq('id', lineToDelete.id);
             if (!delError) {
               fixes.push({ roznamchaId: roz.id, deletedLine: lineToDelete });
             } else {
               return NextResponse.json({ error: "Failed to delete", details: delError });
             }
          }
        } else if (ledgers && ledgers.length === 1) {
           // Both lines use the SAME ledger? In cash entry, it happens if they did something weird.
           const lineToDelete = roz.roznamcha_lines[1];
           const { error: delError } = await admin.from('roznamcha_lines').delete().eq('id', lineToDelete.id);
           if (!delError) {
             fixes.push({ roznamchaId: roz.id, deletedLine: lineToDelete, reason: "same_ledger" });
           }
        }
      }
    }
    
    return NextResponse.json({ success: true, fixedCount: fixes.length, fixes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
