"use client";

import React, { type ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LoadingWorkflowStep = { id: string; label: string; heading: string; icon: LucideIcon; content: ReactNode; nextLabel?: string };

/** Presentation only: the caller supplies all booking data, controls and writes. */
export function LoadingWorkflow({ heading, bookingNo, backLabel, previousLabel, direction, steps, report, onBack }: {
  heading: string; bookingNo: string; backLabel: string; previousLabel: string; direction: "ltr" | "rtl";
  steps: readonly LoadingWorkflowStep[]; report: ReactNode; onBack: () => void;
}) {
  const [current, setCurrent] = React.useState(steps[0]?.id ?? "");
  return <div className="space-y-4">
    <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
      <Button type="button" size="sm" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/>{backLabel}</Button>
      <h1 className="text-lg font-bold text-blue-800 dark:text-blue-300">{heading} <span className="font-mono" dir="ltr">{bookingNo}</span></h1>
    </Card>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Tabs dir={direction} value={current} onValueChange={setCurrent} className="min-w-0">
        <TabsList aria-label={heading} className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border bg-card p-1 sm:grid-cols-4">
          {steps.map(s => <TabsTrigger key={s.id} value={s.id} className="whitespace-normal px-1 py-2 text-xs font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-blue-800">{s.label}</TabsTrigger>)}
        </TabsList>
        {steps.map((s, i) => <TabsContent key={s.id} value={s.id} className="min-w-0">
          <Card className="overflow-hidden rounded-xl">
            <h2 className="flex items-center gap-2 border-b bg-slate-50 p-4 text-xs font-black uppercase tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-100"><s.icon className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true"/>{s.heading}</h2>
            <CardContent className="space-y-4 p-4">
              {s.content}
              {i < steps.length - 1 && <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                {i > 0 && <Button variant="outline" size="sm" type="button" onClick={() => setCurrent(steps[i - 1].id)}>{previousLabel}</Button>}
                <Button size="sm" type="button" onClick={() => setCurrent(steps[i + 1].id)}>{s.nextLabel ?? steps[i + 1].label}</Button>
              </div>}
            </CardContent>
          </Card>
        </TabsContent>)}
      </Tabs>
      <aside className="min-w-0 space-y-4">{report}</aside>
    </div>
  </div>;
}

export function LoadingWorkflowReport({ heading, icon: Icon, children, accent = false }: { heading: string; icon: LucideIcon; children: ReactNode; accent?: boolean }) {
  return <Card className="overflow-hidden rounded-xl">
    <h2 className={`flex items-center gap-2 p-3 text-xs font-black uppercase tracking-wide text-white ${accent ? "bg-blue-800" : "bg-slate-900"}`}><Icon className="h-4 w-4 text-blue-200" aria-hidden="true"/>{heading}</h2>
    <CardContent className="p-3">{children}</CardContent>
  </Card>;
}
