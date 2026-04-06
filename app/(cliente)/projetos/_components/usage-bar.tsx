"use client";

type UsageBarProps = {
  toneClassName: string;
  value: number;
};

export function UsageBar({ toneClassName, value }: UsageBarProps) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full transition-all ${toneClassName}`} style={{ width: `${value}%` }} />
    </div>
  );
}
