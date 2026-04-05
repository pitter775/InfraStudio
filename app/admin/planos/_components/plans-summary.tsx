"use client";

import type { LucideIcon } from "lucide-react";

type SummaryItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type PlansSummaryProps = {
  items: SummaryItem[];
};

export function PlansSummary({ items }: PlansSummaryProps) {
  return (
    <section className="grid gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 rounded-3xl bg-white/[0.04] px-4 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-slate-200">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="mt-1 truncate text-2xl font-black text-white">{item.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
