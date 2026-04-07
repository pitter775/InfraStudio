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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-[26px] border border-white/8 bg-white/[0.04] px-4 py-4 sm:px-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-slate-200 sm:h-11 sm:w-11">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.18em]">
                {item.label}
              </p>
              <p className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">{item.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
