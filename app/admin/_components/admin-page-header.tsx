import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  eyebrowIcon,
  title,
  description,
  badges,
  actions,
  children,
}: AdminPageHeaderProps) {
  return (
    <section className="px-1 py-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              {eyebrowIcon}
              {eyebrow}
            </div>
          ) : null}
          {badges ? <div className="mb-4 flex flex-wrap gap-2">{badges}</div> : null}
          <h1 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-slate-100 sm:text-[1.9rem]">{title}</h1>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
