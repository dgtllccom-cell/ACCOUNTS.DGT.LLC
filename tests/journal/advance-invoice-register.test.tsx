import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SourceFilteredTable } from '@/features/journal/components/source-filtered-table';

// The Advance register uses the compact 15-column layout (restored in 8b4fb515). The per-row invoice / paid /
// remaining cells were removed on purpose, so this test checks the layout that is shown now: each Advance row has
// one three-dot action menu, and the menu lists New Entry, Full View, Payment History, Transfer and Print.
const row={id:'bill-1',purchase_order_no:'QA-BILL',order_total:36700,total_goods_original:10000,currency_code:'USD',exchange_rate:3.67,advance_paid:0,form_data:{form:{secondaryCurrency:'AED',advancePercent:20}}};
const posted=[{id:'p1',status:'posted',kind:'advance',amount:3670,currency_code:'AED',exchange_rate:3.67},{id:'p2',status:'posted',kind:'remaining',amount:3700,currency_code:'AED',exchange_rate:3.7},{id:'booking',status:'posted',kind:'booking',amount:0,currency_code:'AED',exchange_rate:3.67}];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('advance register compact layout',()=>{
  it.each(['all','purchase_booking','local_purchase'] as const)('shows the three-dot action menu with its five actions in the %s source view',async sourceFilter=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({ok:true,data:{payments:posted,limit:200}})})));
    act(()=>{localStorage.setItem('erp_lang','en');window.dispatchEvent(new Event('erp_language_changed'));});
    const selectedRow=sourceFilter==='local_purchase' ? {...row,order_type:'local_purchase',purchase_cost:10000,final_cost:36700} : row;
    render(<SourceFilteredTable sourceFilter={sourceFilter} onSourceChange={()=>{}} rows={[selectedRow]} counts={{all:1,booking:1,local:1}} lang="en" onSelectOrder={()=>{}} onOpenFullBill={()=>{}} onPrintStatement={()=>{}} tGlobal={(_l:any,_k:string,f:string)=>f} activeMode="advance" />);
    await waitFor(()=>expect(screen.getAllByRole('button',{name:/action/i}).length).toBeGreaterThan(0));
    expect(screen.queryByTestId('invoice-summary-paid')).toBeNull();
    expect(screen.queryByTestId('invoice-summary-invoice')).toBeNull();
    expect(screen.queryByTestId('invoice-summary-remaining')).toBeNull();
    fireEvent.click(screen.getAllByRole('button',{name:/action/i})[0]);
    for (const label of [/new entry/i,/full view/i,/payment history/i,/transfer/i,/print/i]) {
      expect(screen.getByRole('menuitem',{name:label})).toBeTruthy();
    }
  });
});
