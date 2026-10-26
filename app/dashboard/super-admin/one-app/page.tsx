import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect, forbidden } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "DGT ERP ONE APP — Master Work Status" };
export const dynamic = "force-dynamic";

type Row = { id: string; module: string; evidence: string; state: string };
type Locale = "en" | "ur" | "ar" | "fa" | "ps";
const label: Record<Locale, Record<string,string>> = {
 en: { title:"DGT ERP ONE APP",subtitle:"Master work status · Repository evidence snapshot, not a LIVE production audit",all:"All work cards",verified:"Verified in reported scope",testing:"Testing / awaiting confirmation",progress:"In progress",blocked:"Blocked",unknown:"Unverified",search:"Filter by name, ID or issue",filter:"Status",id:"ID",module:"Module",evidence:"Last reported evidence / unresolved work",status:"Status",source:"Repository source document",notice:"These statuses come from a tracked review document. They are NOT live application tests, production records, or a task database.",empty:"No matching work cards.",updated:"Source reviewed 26 Oct 2026. Check the linked evidence before closing any card.",error:"Review document cannot be read. No artificial data is shown." },
 ur: { title:"ڈی جی ٹی ERP ون ایپ",subtitle:"تمام کاموں کی صورتحال · یہ گٹ ہب ریکارڈ ہے، LIVE آڈٹ نہیں",all:"تمام کام",verified:"رپورٹ کردہ ٹیسٹ کامیاب",testing:"جانچ باقی",progress:"کام جاری",blocked:"رکا ہوا",unknown:"تصدیق باقی",search:"نام، نمبر یا مسئلہ تلاش کریں",filter:"حالت",id:"نمبر",module:"ماڈیول",evidence:"پچھلی رپورٹ اور باقی کام",status:"حالت",source:"گٹ ہب کی اصل فائل",notice:"یہ نتائج محفوظ شدہ رپورٹ سے لیے گئے ہیں۔ انہیں موجودہ LIVE سرور یا ڈیٹا بیس کی تصدیق نہ سمجھیں۔",empty:"کوئی کام نہیں ملا۔",updated:"فہرست کا جائزہ 26 اکتوبر 2026 کو لیا گیا۔ مکمل کرنے سے پہلے ثبوت دیکھیں۔",error:"رپورٹ نہیں کھل سکی، اس لیے کوئی فرضی ڈیٹا نہیں دکھایا جا رہا۔" },
 ar: { title:"تطبيق DGT ERP الموحد",subtitle:"حالة جميع المهام · سجل GitHub وليس تدقيق الإنتاج المباشر",all:"جميع المهام",verified:"تم التحقق ضمن نطاق التقرير",testing:"بانتظار الاختبار",progress:"قيد العمل",blocked:"متعطل",unknown:"غير متحقق",search:"ابحث بالاسم أو الرقم أو المشكلة",filter:"الحالة",id:"الرقم",module:"الوحدة",evidence:"الأدلة المبلغ عنها والعمل المتبقي",status:"الحالة",source:"ملف المصدر في GitHub",notice:"تأتي الحالات من سجل محفوظ، ولا تمثل فحوص الإنتاج الحية أو سجلات قاعدة البيانات.",empty:"لا توجد مهام مطابقة.",updated:"رُوجع المصدر في 26 أكتوبر 2026؛ تحقق من الأدلة قبل الإغلاق.",error:"تعذر قراءة سجل المهام، ولن تُعرض بيانات وهمية." },
 fa: { title:"برنامه یکپارچه DGT ERP",subtitle:"وضعیت همه کارها · سند GitHub، نه بررسی زنده تولید",all:"همه کارها",verified:"تأییدشده در گزارش",testing:"در انتظار آزمون",progress:"در حال انجام",blocked:"مسدود",unknown:"تأییدنشده",search:"جست‌وجو با نام، شماره یا مشکل",filter:"وضعیت",id:"شماره",module:"بخش",evidence:"شواهد گزارش‌شده و کار باقی‌مانده",status:"وضعیت",source:"پرونده منبع در GitHub",notice:"این وضعیت‌ها از سند ثبت‌شده گرفته شده‌اند و به معنای تأیید سامانه زنده یا داده‌های تولید نیستند.",empty:"کاری یافت نشد.",updated:"منبع در ۲۶ اکتبر ۲۰۲۶ بررسی شده است؛ پیش از بستن کار شواهد را ببینید.",error:"سند خوانده نشد؛ داده ساختگی نمایش داده نمی‌شود." },
 ps: { title:"د DGT ERP يو ګډ اپ",subtitle:"د ټولو کارونو حالت · د GitHub ثبت، نه د ژوندی سيسټم پلټنه",all:"ټول کارونه",verified:"په راپور کې تاييد شوي",testing:"ازموينه پاتې ده",progress:"کار روان دی",blocked:"بند شوی",unknown:"نه دی تاييد شوی",search:"په نوم، شمېر يا ستونزه ولټوئ",filter:"حالت",id:"شمېره",module:"برخه",evidence:"راپور شوي شواهد او پاتې کار",status:"حالت",source:"په GitHub کې اصلي سند",notice:"دا حالتونه له ثبت شوي سند څخه اخيستل شوي؛ د ژوندی سيسټم يا د توليد د معلوماتو تاييد نه دی.",empty:"اړوند کار ونه موندل شو.",updated:"سند د ۲۰۲۶ اکتوبر پر ۲۶ کتل شوی؛ د کار له تړلو مخکې شواهد وګورئ.",error:"سند ونه لوستل شو؛ جعلي معلومات نه ښودل کېږي." }
};
const color: Record<string,string> = { verified:"bg-emerald-100 text-emerald-900", testing:"bg-orange-100 text-orange-900", progress:"bg-blue-100 text-blue-900", blocked:"bg-rose-100 text-rose-900", unknown:"bg-slate-100 text-slate-800" };
const statusKey: Record<string,string> = { "🟢":"verified","🟠":"testing","🔵":"progress","🔴":"blocked","⚪":"unknown" };
const repoLink = "https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC/blob/main/docs/DGT-ERP-ONE-APP-STATUS.md";

function parseRows(source:string): Row[] {
 const result:Row[] = [];
 for(const line of source.split(/\r?\n/)) {
  const match = /^\|\s*(\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([🟢🟠🔵🔴⚪])\s*\|/.exec(line);
  if(!match) continue;
  result.push({id: match[1],module:match[2].trim(),evidence:match[3].trim().replaceAll(/\`/g,""),state:statusKey[match[4]]??"unknown"});
 }
 return result;
}
export default async function OneAppMasterStatus({searchParams}:{searchParams:Promise<{q?:string;s?:string}>}) {
 const session=await getCurrentErpSession();
 if(!session) redirect("/auth/login");
 // This owner-only review may include release/security history. Never open to ordinary staff.
 if(!session.isSuperAdmin) forbidden();
 const rawLang=await getRequestLanguage();
 const lang=(rawLang in label?rawLang:"en") as Locale;
 const t=label[lang];
 const params=await searchParams;
 const q=String(params.q??"").slice(0,100).trim().toLocaleLowerCase();
 const s=String(params.s??"all");
 let rows:Row[]=[];let error=false;
 try {
  const file=await readFile(path.join(process.cwd(),"docs","DGT-ERP-ONE-APP-STATUS.md"),"utf8");
  rows=parseRows(file);
 }catch{error=true;}
 const rtl=lang!=="en";
 const keys=["verified","testing","progress","blocked","unknown"];
 const counts=Object.fromEntries(keys.map(k=>[k,rows.filter(x=>x.state===k).length]));
 const shown=rows.filter(r=>(s==="all"||r.state===s)&&(!q||[r.id,r.module,r.evidence].some(v=>v.toLocaleLowerCase().includes(q))));
 return <main dir={rtl?"rtl":"ltr"} className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
  <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
   <div className="text-xs font-bold uppercase tracking-wider text-slate-500">DGT · OWNER REVIEW</div>
   <h1 className="mt-2 text-3xl font-bold text-slate-900">{t.title}</h1>
   <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>
  </header>
  <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="note">{t.notice}</aside>
  <section aria-label={t.all} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
   {[{key:"all",count:rows.length},...keys.map(key=>({key,count:counts[key]}))].map(item=><div key={item.key} className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="text-2xl font-bold tabular-nums">{item.count}</div>
    <div className="mt-1 text-xs font-medium text-slate-600">{t[item.key]}</div>
   </div>)}
  </section>
  <form className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row" method="get">
   <label className="flex-1 text-sm font-medium">{t.search}<input name="q" defaultValue={q} type="search" maxLength={100} className="mt-1 w-full rounded-lg border p-2 text-slate-900" /></label>
   <label className="text-sm font-medium">{t.filter}<select name="s" defaultValue={keys.includes(s)?s:"all"} className="mt-1 w-full rounded-lg border p-2 text-slate-900">{["all",...keys].map(key=><option key={key} value={key}>{t[key]}</option>)}</select></label>
   <button className="self-end rounded-lg bg-slate-900 px-5 py-2 text-white" type="submit">{t.search}</button>
  </form>
  {error?<p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-900">{t.error}</p>:
  <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[750px] text-sm">
   <thead className="bg-slate-100 text-slate-700"><tr>{[t.id,t.module,t.evidence,t.status].map(v=><th key={v} scope="col" className="p-3 text-start">{v}</th>)}</tr></thead>
   <tbody>{shown.map(row=><tr key={row.id} className="border-t align-top">
    <td className="p-3 font-semibold">{row.id}</td><td className="p-3 font-semibold">{row.module}</td>
    <td className="p-3 text-slate-600">{row.evidence}</td>
    <td className="p-3"><span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${color[row.state]}`}>{t[row.state]}</span></td>
   </tr>)}</tbody>
  </table>{shown.length===0&&<p className="p-6 text-center text-slate-500">{t.empty}</p>}</div>}
  <footer className="flex flex-wrap justify-between gap-3 text-xs text-slate-500"><span>{t.updated}</span><a className="font-semibold underline" href={repoLink} target="_blank" rel="noopener noreferrer">{t.source}</a></footer>
 </main>;
}
