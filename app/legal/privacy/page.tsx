import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "DGT.llc — Privacy Policy" };
export const dynamic = "force-dynamic";

const UPDATED = "2026-10-10";

/** Public privacy policy for the DGT.llc B and DGT.llc BS mobile apps (required by Google Play, App Store and Galaxy Store). Five languages. */
export default async function PrivacyPolicyPage() {
  const lang = await getRequestLanguage();
  const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const T = (key: string, en: string) => t(lang, `privacy.${key}`, en);
  const Section = ({ h, children }: { h: string; children: React.ReactNode }) => (
    <section>
      <h2 className="text-base font-bold">{h}</h2>
      {children}
    </section>
  );
  return (
    <main dir={rtl ? "rtl" : "ltr"} className="mx-auto max-w-3xl px-5 py-10 text-slate-900">
      <h1 className="text-2xl font-black">{T("title", "Privacy Policy — DGT.llc B and DGT.llc BS")}</h1>
      <p className="mt-1 text-sm text-slate-500">{T("updated", "Last updated")}: <span dir="ltr">{UPDATED}</span></p>
      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <Section h={T("s1_h", "Who we are")}><p>{T("s1_b", "DGT.llc B (Business) and DGT.llc BS (Business Shipping) are the mobile apps of the DGT ERP operated by DAMAAN GENERAL TRADING LLC (“DGT”). They are used by staff, shipping-line and clearing-agent users and customers whose accounts were issued by DGT. There is no public sign-up.")}</p></Section>
        <Section h={T("s2_h", "What the apps do with data")}><p>{T("s2_b", "The apps display the DGT ERP over a secure HTTPS connection. Business records stay on DGT’s servers; the apps do not keep a copy on your device other than normal temporary web-view caching and your sign-in session.")}</p></Section>
        <Section h={T("s3_h", "Information we process")}>
          <ul className="list-disc ps-5">
            <li>{T("s3_i1", "Account information — your name, e-mail or user code, role, and the country/branch you are authorised for, to sign you in and show only what you may see.")}</li>
            <li>{T("s3_i2", "Business content you enter or upload — for example shipment details, bills and documents, saved in the ERP by your organisation.")}</li>
            <li>{T("s3_i3", "Camera and photos — only when you choose to attach a document or photo; nothing is accessed in the background.")}</li>
            <li>{T("s3_i4", "Notification token — if you allow notifications, a device token used only to send you ERP alerts.")}</li>
            <li>{T("s3_i5", "Security logs — sign-in and activity records kept in the ERP for audit and fraud protection.")}</li>
          </ul>
        </Section>
        <Section h={T("s4_h", "What we do not do")}><p>{T("s4_b", "No advertising, no sale of data, no third-party analytics or tracking SDKs, and no location tracking.")}</p></Section>
        <Section h={T("s5_h", "Security")}><p>{T("s5_b", "All traffic uses HTTPS. Access is limited by your role, country and branch, and is checked on the server for every request.")}</p></Section>
        <Section h={T("s6_h", "Retention, access and deletion")}><p>{T("s6_b", "Records are kept as long as your organisation needs them. To correct or delete your account, contact your organisation’s ERP administrator or DGT.")}</p></Section>
        <Section h={T("s7_h", "Children")}><p>{T("s7_b", "The apps are business tools and are not directed at children.")}</p></Section>
        <Section h={T("s8_h", "Changes")}><p>{T("s8_b", "We will update this page when the apps or the law change, and show the new date above.")}</p></Section>
      </div>
    </main>
  );
}
