import { getDashboardHeroCopy, type DashboardHeroVariant } from "@/lib/i18n/dashboard-hero";

type DashboardHeroBannerProps = {
  variant: DashboardHeroVariant;
  lang: string;
};

/**
 * Compact, decorative hero using the ERP's existing local logistics image.
 * Never loads external assets, queries data, or adds operational actions.
 */
export function DashboardHeroBanner({ variant, lang }: DashboardHeroBannerProps) {
  const copy = getDashboardHeroCopy(variant, lang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang.toLowerCase().split("-")[0]);

  return (
    <section
      aria-label={copy.heading}
      dir={isRtl ? "rtl" : "ltr"}
      className="relative isolate overflow-hidden rounded-2xl border border-sky-400/25 bg-[#08234c] shadow-md"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(3, 19, 44, .88), rgba(5, 39, 82, .65) 56%, rgba(5, 45, 95, .34)), url('/images/global_logistics_hero.jpg')",
        }}
      />
      <div className="relative flex min-h-[118px] flex-col justify-center gap-1.5 px-4 py-4 sm:min-h-[144px] sm:px-7 sm:py-5">
        <span className="w-fit rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-sky-100 backdrop-blur-sm">
          {copy.eyebrow}
        </span>
        <h1 className="text-xl font-black leading-snug text-white drop-shadow-sm sm:text-3xl">
          {copy.heading}
        </h1>
        <p className="max-w-[690px] text-[11px] font-semibold leading-relaxed text-sky-50/95 sm:text-sm">
          {copy.description}
        </p>
      </div>
    </section>
  );
}
