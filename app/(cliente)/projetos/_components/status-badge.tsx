"use client";

import type { ProjetoStatusTone } from "./types";

type StatusBadgeProps = {
  status: ProjetoStatusTone;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${status.badge}`}>
      {status.label}
    </span>
  );
}
