import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { act, cleanup, render, screen, within, fireEvent } from '@testing-library/react';
import { purchaseInvoiceSummary, isActualInvoicePayment } from '@/lib/journal/purchase-invoice-summary';
import { PurchaseInvoiceSummaryPanel } from '@/features/journal/components/purchase-invoice-summary';
import { t, type UiKey } from '@/lib/i18n/ui';
import { officeCurrencyForCountryName } from '@/lib/journal/purchase-payment-entry-model';

const order = { order_total: 36700, total_goods_original: 10000, currency_code: 'USD', exchange_rate: 3.67,
  advance_paid: 2000, remaining_due: 1000, form_data: {form: {secondaryCurrency: 'AED', advancePercent: 30}} };
const pay = (id: string, amount: number, rate: number | null, ccy='AED', extra={}) =>
  ({id, kind:'advance', status:'posted', amount, currency_code:ccy, exchange_rate:rate, entry_date:'2026-11-08', ...extra});
afterEach(cleanup);

describe('saved invoice currency projection', () => {
  it('shows purchase original, preserves different payment rates, and values the whole remaining invoice at invoice rate', () => {
    const s=purchaseInvoiceSummary(order, [pay('a',3670,3.67),pay('b',3700,3.7)]);
    expect(s.invoice).toEqual({purchase:10000,final:36700});
    expect(s.paid).toEqual({purchase:2000,final:7370});
    expect(s.remaining).toEqual({purchase:8000,final:29360});
    expect(s.payments.map(p=>p.rate)).toEqual([3.67,3.7]);
    expect(s.remaining.purchase).not.toBe(1000); // unpaid advance is a separate requirement
  });
  it('never adds the cached advance to saved payment rows', () => {
    const s=purchaseInvoiceSummary({...order,advance_paid:3670},[pay('a',3670,3.67)]);
    expect(s.paid.purchase).toBe(1000);
  });
  it('does not double-convert a final-currency payment or label the final invoice as USD', () => {
    const s=purchaseInvoiceSummary(order,[pay('a',3670,3.67)]);
    expect(s.invoice.purchase).toBe(10000); expect(s.paid.final).toBe(3670);
  });
  it('converts purchase-currency payments once using the posted rate', () => {
    expect(purchaseInvoiceSummary(order,[pay('a',1000,3.7,'USD')]).paid).toEqual({purchase:1000,final:3700});
  });
  it('deduplicates repeated rows, including an advance', () => {
    const p=pay('a',3670,3.67); expect(purchaseInvoiceSummary(order,[p,p]).paid.purchase).toBe(1000);
  });
  it.each(['booking','accrual'])('excludes %s entries even when posted', kind => {
    expect(isActualInvoicePayment(pay('a',3670,3.67,'AED',{kind}))).toBe(false);
  });
  it.each(['draft','cancelled','canceled','pending','reversed',''])('excludes %s payment status', status => {
    expect(isActualInvoicePayment(pay('a',3670,3.67,'AED',{status}))).toBe(false);
  });
  it('excludes deleted payments and includes remaining and actual credit payments', () => {
    const s=purchaseInvoiceSummary(order,[pay('x',1,1,'USD',{deleted_at:'2026-11-08'}),pay('a',100,3.7,'USD',{kind:'remaining'}),pay('b',100,3.6,'USD',{kind:'credit'})]);
    expect(s.paid).toEqual({purchase:200,final:730});
  });
  it('does not replace a missing posted conversion rate with the invoice rate', () => {
    const s=purchaseInvoiceSummary(order,[pay('a',3670,null)]);
    expect(s.paid).toEqual({purchase:null,final:3670});
    expect(s.remaining).toEqual({purchase:null,final:null});
    expect(s.payments[0].rate).toBeNull();
  });
  it('keeps known purchase amounts when historical final conversion is unavailable', () => {
    const s=purchaseInvoiceSummary(order,[pay('a',1000,null,'USD')]);
    expect(s.paid).toEqual({purchase:1000,final:null});
    expect(s.remaining).toEqual({purchase:9000,final:33030});
  });
  it('has no invoice conversion when the saved rate is absent', () => {
    const s=purchaseInvoiceSummary({...order,exchange_rate:null,order_total:null},[]);
    expect(s.invoice).toEqual({purchase:10000,final:null}); expect(s.invoiceRate).toBeNull();
  });
  it('recovers a purchase original from an explicitly converted total once, for rates below one too', () => {
    const s=purchaseInvoiceSummary({currency_code:'AED',order_total:2500,exchange_rate:0.25,form_data:{form:{secondaryCurrency:'USD'}}},[]);
    expect(s.invoice).toEqual({purchase:10000,final:2500});
  });
  it('does not guess a missing third-currency cross rate', () => {
    const s=purchaseInvoiceSummary(order,[pay('a',1000,0.5,'CNY')]);
    expect(s.paid).toEqual({purchase:null,final:null});
  });
  it('returns unknown rather than incomplete capped or failed totals', () => {
    expect(purchaseInvoiceSummary(order,null).paid.purchase).toBeNull();
    expect(purchaseInvoiceSummary(order,[pay('a',3670,3.67)],'',false).remaining.purchase).toBeNull();
  });
  it('does not fabricate conversion information for legacy aggregate-only payments', () => {
    expect(purchaseInvoiceSummary(order,[]).paid).toEqual({purchase:null,final:null});
  });
  it('treats same-currency invoices as identity without a historical FX rate', () => {
    const s=purchaseInvoiceSummary({...order,currency_code:'AED',exchange_rate:null},[pay('a',1000,null)]);
    expect(s.invoiceRate).toBe(1); expect(s.paid).toEqual({purchase:1000,final:1000});
  });
  it('reads local purchase original and final separately', () => {
    const s=purchaseInvoiceSummary({order_type:'local_purchase',purchase_currency:'USD',local_currency:'AED',purchase_cost:1000,final_cost:3670,exchange_rate:3.67},[]);
    expect(s.invoice).toEqual({purchase:1000,final:3670});
  });
  it('uses actual goods instead of a zero default original column', () => {
    const s=purchaseInvoiceSummary({...order,total_goods_original:0,form_data:{form:{secondaryCurrency:'AED'},goodsEntries:[{totalAmount:10000,finalAmount:36700}]}},[]);
    expect(s.invoice.purchase).toBe(10000);
  });
  it('does not turn an empty goods array into an invoice worth zero', () => {
    expect(purchaseInvoiceSummary({currency_code:'USD',exchange_rate:3.67,order_total:36700,form_data:{goodsEntries:[],form:{secondaryCurrency:'AED'}}},[]).invoice.purchase).toBe(10000);
  });
  it('recovers an original from a converted total when the original column has only its zero default', () => {
    const s=purchaseInvoiceSummary({total_goods_original:0,order_total:36700,currency_code:'USD',exchange_rate:3.67,base_currency:'AED'},[]);
    expect(s.invoice).toEqual({purchase:10000,final:36700});
  });
  it('shows an unknown original when a zero default cannot be recovered without an invoice rate', () => {
    const s=purchaseInvoiceSummary({total_goods_original:0,order_total:36700,currency_code:'USD',base_currency:'AED'},[]);
    expect(s.invoice.purchase).toBeNull(); expect(s.invoiceRate).toBeNull();
  });
  it('does not reconvert a Local Purchase adapter total when the original is unavailable', () => {
    const s=purchaseInvoiceSummary({order_type:'local_purchase',purchase_currency:'USD',local_currency:'AED',exchange_rate:3.67,final_cost:3670,form_data:{form:{totalAmount:3670},goodsEntries:[{totalAmount:3670}]}},[]);
    expect(s.invoice).toEqual({purchase:1000,final:3670});
  });
  it('does not label a synthetic Local Purchase final total as an original when its rate is missing', () => {
    const s=purchaseInvoiceSummary({order_type:'local_purchase',purchase_currency:'USD',local_currency:'AED',final_cost:3670,form_data:{form:{totalAmount:3670}}},[]);
    expect(s.invoice).toEqual({purchase:null,final:3670});
  });
  it('keeps an unknown office currency unknown for invoice display, preserving the existing payment default', () => {
    expect(officeCurrencyForCountryName('Atlantis')).toBe('USD');
    expect(officeCurrencyForCountryName('Atlantis','')).toBe('');
    const s=purchaseInvoiceSummary({currency_code:'USD',total_goods_original:1000,order_total:3670,exchange_rate:3.67},[],officeCurrencyForCountryName('Atlantis',''));
    expect(s.finalCurrency).toBe(''); expect(s.invoiceRate).toBe(3.67);
  });
  it('uses a saved branch currency without inferring it from an unknown country', () => {
    const s=purchaseInvoiceSummary({currency_code:'USD',total_goods_original:1000,exchange_rate:3.67,form_data:{form:{branchCurrency:'AED'}}},[]);
    expect(s.finalCurrency).toBe('AED'); expect(s.invoice.final).toBe(3670);
  });
});

describe('invoice summary rendering', () => {
  it.each(['en','ur','ar','fa','ps'])('shows all three translated sections and correct direction in %s', lang => {
    act(() => { localStorage.setItem('erp_lang',lang); document.documentElement.lang=lang; window.dispatchEvent(new Event('erp_language_changed')); });
    render(<PurchaseInvoiceSummaryPanel lang={lang} summary={purchaseInvoiceSummary(order,[pay('a',3670,3.67),pay('b',3700,3.7)])} />);
    const panel=screen.getByTestId('purchase-invoice-summary');
    expect(panel.getAttribute('dir')).toBe(lang==='en'?'ltr':'rtl');
    for(const key of ['invoice','paid','remaining']) expect(within(panel).getByText(t(lang,`pis.${key}` as UiKey))).toBeTruthy();
    expect(within(screen.getByTestId('invoice-summary-invoice')).getByText('10,000.00 USD')).toBeTruthy();
    expect(within(screen.getByTestId('invoice-summary-remaining')).getByText('29,360.00 AED')).toBeTruthy();
    const details=within(screen.getByTestId('invoice-summary-paid')).getByText(/\(2\)/);
    fireEvent.click(details);
    expect(within(panel).getAllByText('1 USD = 3.7000 AED').length).toBe(1);
  });
  it('renders missing historical conversions as a dash', () => {
    render(<PurchaseInvoiceSummaryPanel lang="en" summary={purchaseInvoiceSummary(order,[pay('a',3670,null)])} />);
    expect(within(screen.getByTestId('invoice-summary-paid')).getAllByText('—').length).toBeGreaterThan(0);
  });
});
