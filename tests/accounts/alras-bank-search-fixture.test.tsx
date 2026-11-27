import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BankPicker } from "@/features/banks/components/bank-picker";
const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.stubGlobal("React", React);
vi.mock("@/lib/i18n/use-active-language", () => ({useActiveLanguage: () => "en"}));
vi.mock("@/features/banks/bank-api", () => ({listBanks:list,getBankById:vi.fn()}));
vi.mock("@/features/banks/components/bank-form", () => ({BankForm: () => null}));
vi.mock("@/components/ui/search-select", () => ({SearchSelect:(p:any)=><><input aria-label="search" onChange={(e)=>p.onSearchValueChange?.(e.target.value)}/>{p.options.map((o:any)=><div key={o.value}>{o.label}</div>)}</>}));
const bank=(id:string)=>({id,bank_name:`DEMO BANK ${id}`,account_title:"TEST",account_number:id});
afterEach(()=>{cleanup();list.mockReset();});
it("searches past the first 100 without widening the country",async()=>{
 list.mockImplementation(async (p: {q?:string})=>p.q?[bank("300")]:Array.from({length:100},(_,i)=>bank(String(i))));
 render(<BankPicker label="Bank" value="" countryId="approved-country" searchAll onValueChange={()=>{}}/>);
 await screen.findByText("DEMO BANK 99 — TEST");
 expect(screen.queryByText("DEMO BANK 300 — TEST")).toBeNull();
 fireEvent.change(screen.getByRole("textbox",{name:"search"}),{target:{value:"300"}});
 await screen.findByText("DEMO BANK 300 — TEST");
 expect(list).toHaveBeenCalledWith({q:"300",countryId:"approved-country",limit:100,excludeDemo:true});
});
it("keeps existing consumers on their current initial list",async()=>{
 list.mockResolvedValue([bank("1")]);
 render(<BankPicker label="Bank" value="" onValueChange={()=>{}}/>);
 await screen.findByText("DEMO BANK 1 — TEST");
 fireEvent.change(screen.getByRole("textbox",{name:"search"}),{target:{value:"300"}});
 await waitFor(()=>expect(list).toHaveBeenCalledTimes(1));
});
it("hides a demo bank from payment pickers but makes it available for profile linking",async()=>{
 const demo={...bank("1"),account_number:"DEMO-NONPAY-AE-0001"};
 list.mockResolvedValue([demo,bank("2")]);
 const {rerender}=render(<BankPicker label="Bank" value="" onValueChange={()=>{}}/>);
 await screen.findByText("DEMO BANK 2 — TEST");
 expect(screen.queryByText("DEMO BANK 1 — TEST")).toBeNull();
 rerender(<BankPicker label="Bank" value="" includeDemoBanks onValueChange={()=>{}}/>);
 await screen.findByText("DEMO BANK 1 — TEST");
});
