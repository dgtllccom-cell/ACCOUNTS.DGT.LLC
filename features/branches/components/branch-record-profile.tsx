import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BranchProfileItem = {
  label: string;
  value: string | null | undefined;
};

export type BranchProfileSection = {
  title: string;
  items: BranchProfileItem[];
};

function hasValue(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized && normalized !== "-");
}

function valueText(value: string | null | undefined) {
  return hasValue(value) ? String(value) : "Missing";
}

export function BranchRecordProfile({
  title,
  subtitle,
  identity,
  sections
}: {
  title: string;
  subtitle?: string;
  identity: BranchProfileItem[];
  sections: BranchProfileSection[];
}) {
  const fieldItems = sections.flatMap((section) => section.items);
  const completed = fieldItems.filter((item) => hasValue(item.value)).length;
  const missing = Math.max(0, fieldItems.length - completed);
  const completion = fieldItems.length ? Math.round((completed / fieldItems.length) * 100) : 0;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
          </div>
          <div className="rounded-full border bg-background px-3 py-1 text-xs font-semibold text-foreground">
            Profile Completion: {completion}%
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {identity.map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/10 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
              <div className={cn("mt-1 text-sm font-semibold", hasValue(item.value) ? "text-foreground" : "text-rose-600")}>
                {valueText(item.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Completed Fields" value={completed} tone="success" />
          <Metric label="Missing Fields" value={missing} tone="danger" />
          <Metric label="Profile Completion" value={`${completion}%`} tone={missing ? "warning" : "success"} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => {
            const sectionComplete = section.items.every((item) => hasValue(item.value));
            return (
              <div key={section.title} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</div>
                  <StatusBadge complete={sectionComplete} />
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <div key={`${section.title}-${item.label}`} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={cn("max-w-[60%] text-right font-semibold", hasValue(item.value) ? "text-foreground" : "text-rose-600")}>
                        {valueText(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: "success" | "danger" | "warning" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
        : "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
  return (
    <div className={cn("rounded-lg border px-3 py-2", toneClass)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
      )}
    >
      {complete ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
      {complete ? "Completed" : "Missing Information"}
    </span>
  );
}
