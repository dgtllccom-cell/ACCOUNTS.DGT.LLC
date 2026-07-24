import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PrintButton } from "@/components/documents/print-button";

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b-2 border-r-2 border-neutral-800 p-3 even:border-r-0">
      <p className="mb-1 text-[11px] font-extrabold uppercase text-neutral-600">{label}</p>
      <div className="whitespace-pre-line text-xs leading-5 text-neutral-950">{children}</div>
    </div>
  );
}

function PortBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-r-2 border-neutral-800 p-3 last:border-r-0">
      <p className="mb-1 text-[11px] font-extrabold uppercase text-neutral-600">{label}</p>
      <div className="whitespace-pre-line text-xs leading-5 text-neutral-950">{children}</div>
    </div>
  );
}

export default function BillOfLadingPage() {
  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/dashboard/documents"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Documents
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Bill of Lading</h1>
          <p className="text-sm text-muted-foreground">
            Printable ocean transport document template for shipping records.
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="mx-auto max-w-[1020px] bg-[#eef2ff] p-3 text-neutral-950 print:max-w-none print:bg-white print:p-0">
        <div className="relative overflow-hidden border-2 border-neutral-800 bg-white">
          <div className="pointer-events-none absolute inset-0 grid rotate-[-22deg] select-none place-items-center text-[140px] font-black tracking-[8px] text-black/10">
            MNR
          </div>

          <header className="relative z-[1] grid gap-3 border-b-2 border-neutral-800 p-3 md:grid-cols-[240px_1fr_260px]">
            <div className="grid h-[82px] w-[220px] place-items-center border border-neutral-800 bg-neutral-100 text-sm font-extrabold text-neutral-600 print:bg-white">
              YOUR LOGO
            </div>

            <div className="self-center text-center">
              <p className="text-base font-black leading-5">
                BILL OF LADING FOR OCEAN TRANSPORT
                <br />
                OR MULTIMODAL TRANSPORT
              </p>
              <p className="mt-1 text-xs font-extrabold text-neutral-600">(Sample / Template)</p>
            </div>

            <div className="self-center text-xs leading-5">
              {[
                ["B/L No.", "MNR/IRBND/INMUN-040/26"],
                ["Booking No.", "SEJ-54/26"],
                ["Export Ref.", "-"],
                ["Service", "Contract"]
              ].map(([key, value]) => (
                <div key={key} className="grid grid-cols-[80px_10px_1fr] gap-1">
                  <span className="font-bold text-neutral-600">{key}</span>
                  <span>:</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </header>

          <div className="relative z-[1] grid border-b-2 border-neutral-800 md:grid-cols-2">
            <InfoBox label="Shipper">
              <strong>YOUR COMPANY / SHIPPER NAME</strong>
              {"\n"}Address Line 1{"\n"}City, Country{"\n"}TEL: +00 000000000{"\n"}EMAIL:
              example@mail.com
            </InfoBox>
            <InfoBox label="Delivery Agent at place of Delivery">
              <strong>DELIVERY AGENT NAME</strong>
              {"\n"}Office Address{"\n"}City, Country{"\n"}EMAIL: agent@mail.com
            </InfoBox>
            <InfoBox label='Consignee (negotiable if consigned "to order")'>
              <strong>CONSIGNEE NAME</strong>
              {"\n"}Address Line 1{"\n"}City, State, Country{"\n"}PHONE: +00 000000000
              {"\n"}EMAIL: consignee@mail.com
            </InfoBox>
            <InfoBox label="Notify Party">
              <strong>NOTIFY PARTY NAME</strong>
              {"\n"}Address Line 1{"\n"}City, Country
            </InfoBox>
            <InfoBox label="Notify Party 2">-</InfoBox>
            <InfoBox label="Onward inland routing (if any)">-</InfoBox>
          </div>

          <div className="relative z-[1] grid border-b-2 border-neutral-800 md:grid-cols-3">
            <PortBox label="Vessel / Voyage">
              <strong>TB JINJIANG</strong> | Voyage: <strong>005E</strong>
            </PortBox>
            <PortBox label="Port of Loading / Discharge">
              POL: <strong>BANDAR ABBAS</strong>
              {"\n"}POD: <strong>MUNDRA</strong>
            </PortBox>
            <PortBox label="Place of Receipt / Delivery">
              Receipt: -{"\n"}Delivery: <strong>MUNDRA</strong>
            </PortBox>
          </div>

          <section className="relative z-[1]">
            <div className="border-b-2 border-neutral-800 bg-neutral-100 px-3 py-2 text-center text-xs font-black print:bg-white">
              PARTICULAR FURNISHED BY SHIPPER - CARRIER NOT RESPONSIBLE
            </div>

            <div className="grid border-b-2 border-neutral-800 md:grid-cols-[1.2fr_2.2fr_1fr]">
              <div className="border-r-2 border-neutral-800 p-3">
                <p className="mb-1 text-[11px] font-extrabold uppercase text-neutral-600">
                  Marks and Number
                </p>
                <p className="font-mono text-xs">-</p>

                <p className="mb-1 mt-5 text-[11px] font-extrabold uppercase text-neutral-600">
                  Container No. / Seal No.
                </p>
                <p className="whitespace-pre-line font-mono text-xs leading-5">
                  TRIU8614754 / 40HCRF - 26581{"\n"}TRIU8422279 / 40HCRF - 26842
                </p>
              </div>

              <div className="border-r-2 border-neutral-800 p-3">
                <p className="mb-1 text-[11px] font-extrabold uppercase text-neutral-600">
                  No. and Kind of Packages / Description of Goods
                </p>
                <p className="whitespace-pre-line font-mono text-xs leading-5">
                  <strong>4500 CARTONS</strong>
                  {"\n"}2x40HCRF CONTAINER STC:{"\n"}4500 CARTONS WALNUTS KERNEL{"\n"}
                  TEMP: PLUS 5 DEGREE CELSIUS{"\n\n"}PER CONTAINER CARTONS AND WEIGHT
                  {"\n"}2250 CARTONS{"\n"}NET WEIGHT: 22,500.00 KGS{"\n"}GROSS WEIGHT:
                  23,625.00 KGS{"\n\n"}HS CODE 08023200{"\n\n"}INVOICE 02/TRANSIT
                  #A00002232{"\n"}INVOICE 08/TRANSIT #A00002263
                </p>
              </div>

              <div className="p-3">
                <p className="mb-1 text-[11px] font-extrabold uppercase text-neutral-600">
                  Cargo Weight (KGS) / Measurement
                </p>
                <p className="whitespace-pre-line font-mono text-xs leading-5">
                  <strong>Gross Weight</strong>
                  {"\n"}47250.000{"\n\n"}
                  <strong>Net Weight</strong>
                  {"\n"}45000.000{"\n\n"}
                  <strong>Measurement</strong>
                  {"\n"}0.000 CBM
                </p>
              </div>
            </div>
          </section>

          <section className="relative z-[1]">
            <div className="grid border-b-2 border-neutral-800 md:grid-cols-[1.2fr_1fr_1fr]">
              <PortBox label="Freight and Charges">
                <strong>FREIGHT PREPAID</strong>
              </PortBox>
              <PortBox label="Place of Issue of B/L">
                <strong>BANDAR ABBAS</strong>
              </PortBox>
              <PortBox label="Date of Issue of B/L">
                <strong>07-Feb-2026</strong>
              </PortBox>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 text-left print:bg-white">
                  <th className="w-[28%] border border-neutral-800 p-2 font-black">Rate</th>
                  <th className="w-[12%] border border-neutral-800 p-2 font-black">Unit</th>
                  <th className="w-[12%] border border-neutral-800 p-2 font-black">Currency</th>
                  <th className="w-[12%] border border-neutral-800 p-2 font-black">Prepaid</th>
                  <th className="w-[12%] border border-neutral-800 p-2 font-black">Collect</th>
                  <th className="border border-neutral-800 p-2 font-black">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-neutral-800 p-2">-</td>
                  <td className="border border-neutral-800 p-2">-</td>
                  <td className="border border-neutral-800 p-2">-</td>
                  <td className="border border-neutral-800 p-2">Yes</td>
                  <td className="border border-neutral-800 p-2">-</td>
                  <td className="border border-neutral-800 p-2 font-mono leading-5">
                    All destination charges including container detention and THC, if not prepaid,
                    are payable at destination by merchant as per local tariff.
                  </td>
                </tr>
              </tbody>
            </table>

            <footer className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <span className="text-[11px] font-extrabold text-neutral-600">
                CONTINUED ON FOLLOWING PAGE | 1 OF 2
              </span>
              <span className="text-[22px] font-black tracking-wide">YOUR SHIPPING LINE LLC</span>
              <span className="text-[11px] font-extrabold text-neutral-600">NON-NEGOTIABLE</span>
            </footer>
          </section>
        </div>
      </section>
    </div>
  );
}

