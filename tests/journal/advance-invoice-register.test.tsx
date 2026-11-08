import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { SourceFilteredTable } from '@/features/journal/components/source-filtered-table';

const row={id:'bill-1',purchase_order_no:'QA-BILL',order_total:36700,total_goods_original:10000,currency_code:'USD',exchange_rate:3.67,advance_paid:2000,form_data:{form:{secondaryCurrency:'AED'}}};
const posted=[{id:'p1',status:'posted',kind:'advance',amount:3670,currency_code:'AED',exchange_rate:3.67},{id:'p2',status:'posted',kind:'remaining',amount:3700,currency_code:'AED',exchange_rate:3.7},{id:'booking',status:'posted',kind:'booking',amount:36700,currency_code:'AED',exchange_rate:3.67}];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('advance register invoice sections',()=>{
  it.each(['all','purchase_booking','local_purchase'] as const)('reconciles paid and remaining in the %s source view',async sourceFilter=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({ok:true,data:{payments:posted,limit:200}})})));
    act(()=>{localStorage.setItem('erp_lang','en');window.dispatchEvent(new Event('erp_language_changed'));});
    const selectedRow=sourceFilter==='local_purchase' ? {...row,order_type:'local_purchase',purchase_cost:10000,final_cost:36700} : row;
    render(<SourceFilteredTable sourceFilter={sourceFilter} onSourceChange={()=>{}} rows={[selectedRow]} counts={{all:1,booking:1,local:1}} lang="en" onSelectOrder={()=>{}} onOpenFullBill={()=>{}} onPrintStatement={()=>{}} tGlobal={(_,__,fallback)=>fallback} activeMode="advance" />);
    await waitFor(()=>expect(within(screen.getByTestId('invoice-summary-paid')).getByText('2,000.00 USD')).toBeTruthy());
    expect(within(screen.getByTestId('invoice-summary-invoice')).getByText('10,000.00 USD')).toBeTruthy();
    expect(within(screen.getByTestId('invoice-summary-paid')).getByText('7,370.00 AED')).toBeTruthy();
    expect(within(screen.getByTestId('invoice-summary-remaining')).getByText('29,360.00 AED')).toBeTruthy();
    expect(screen.queryByText('Bill Total')).toBeNull();
  });
});
