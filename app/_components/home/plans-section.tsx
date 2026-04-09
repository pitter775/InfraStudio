"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { NICHE_ITEMS } from "@/app/_components/home/data";
import { cn } from "@/lib/utils";

type PlanItem = {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  widthClass: string;
  desktopWrapperClass: string;
  accentClass: string;
  featured?: boolean;
  badge?: string;
  solidCheck?: boolean;
};

const PLAN_ITEMS: PlanItem[] = [
  {
    name: "Free",
    price: "R$ 0",
    description: "Ideal para testar",
    features: ["ate 10.000 creditos de IA", "base inicial para validar a operacao", "site e WhatsApp no mesmo fluxo", "upgrade quando quiser"],
    cta: "Testar grátis",
    widthClass: "w-[240px]",
    desktopWrapperClass:
      "relative scale-90 -translate-y-2 opacity-100 z-10 backdrop-brightness-50 hover:scale-100 hover:z-[999]",
    accentClass: "text-emerald-500",
  },
  {
    name: "Starter",
    price: "R$ 29,90",
    description: "Ideal para começar",
    features: ["ate 50.000 creditos de IA", "operacao inicial com atendimento real", "integracoes e canais liberados", "ciclo simples para comecar"],
    cta: "Começar agora",
    widthClass: "w-[260px]",
    desktopWrapperClass:
      "scale-95 opacity-100 z-20 -translate-y-2 hover:scale-105 hover:z-[999]",
    accentClass: "text-gradient",
  },
  {
    name: "Pro",
    price: "R$ 79,90",
    description: "Melhor custo-benefício",
    features: ["ate 200.000 creditos de IA", "mais volume para atendimento e automacao", "melhor custo para operacao ativa", "crescimento sem trocar a estrutura"],
    cta: "Começar agora",
    widthClass: "w-[250px]",
    desktopWrapperClass: "scale-100 z-30 -translate-y-2 hover:scale-115",
    accentClass: "text-gradient",
    featured: true,
    badge: "MAIS USADO",
  },
  {
    name: "Business",
    price: "R$ 149,90",
    description: "Escalando",
    features: ["ate 500.000 creditos de IA", "operacao com folga de consumo", "mais espaco para integracoes", "pronto para times em rotina pesada"],
    cta: "Começar agora",
    widthClass: "w-[260px]",
    desktopWrapperClass:
      "scale-95 opacity-100 z-20 -translate-y-2 translate-x-2 hover:scale-100 hover:z-[999]",
    accentClass: "text-gradient",
  },
  {
    name: "Scale",
    price: "R$ 299,90",
    description: "Top",
    features: ["ate 1.500.000 creditos", "alto volume mensal", "estrutura para operacoes exigentes", "camada premium para escalar"],
    cta: "Começar agora",
    widthClass: "w-[240px]",
    desktopWrapperClass:
      "scale-90 opacity-70 z-10 -translate-y-2 hover:scale-100 hover:opacity-100 hover:z-[999]",
    accentClass: "text-gradient",
    solidCheck: true,
  },
];

function PlanFeature({ solid = false, children }: { solid?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          solid ? "bg-cyan-400 text-black" : "bg-cyan-400/20 text-cyan-300",
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

function PlanCard({ plan, active = false, mobile = false }: { plan: PlanItem; active?: boolean; mobile?: boolean }) {
  const isFeatured = plan.featured || active;

  return (
    <div
      className={cn(
        "relative rounded-2xl bg-brand-dark p-6 text-left transition-all duration-300",
        mobile ? "w-full max-w-none overflow-hidden pt-10" : plan.widthClass,
        isFeatured ? "border border-blue-500/40 shadow-lg shadow-blue-900/20" : "border border-zinc-800",
        active ? "scale-100 opacity-100" : "",
      )}
    >
      {mobile && active ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.24),rgba(34,211,238,0.12),transparent_68%)]" />
          <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-cyan-300/25 shadow-[0_0_28px_rgba(34,211,238,0.14)]" />
        </>
      ) : null}

      {plan.badge && isFeatured ? (
        <span
          className={cn(
            "absolute rounded-full bg-blue-600 px-3 py-1 text-xs text-white",
            mobile ? "right-4 top-4" : "-top-3 left-1/2 -translate-x-1/2",
          )}
        >
          {plan.badge}
        </span>
      ) : null}

      <div className="relative z-10">
        <span className={cn("font-bold", plan.accentClass)}>{plan.name}</span>

        <h3 className="mt-2 text-2xl font-bold text-white">
          {plan.price}
          <span className="text-sm text-zinc-400">/mês</span>
        </h3>

        <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>

        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {plan.features.map((feature) => (
            <PlanFeature key={feature} solid={plan.solidCheck}>
              {feature}
            </PlanFeature>
          ))}
        </ul>

        <button
          className={cn(
            "mt-6 w-full rounded-xl py-2 font-semibold text-white transition",
            isFeatured ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90" : "bg-zinc-800 hover:bg-zinc-700",
          )}
        >
          {plan.cta}
        </button>
      </div>
    </div>
  );
}

function DesktopPlanCard({ plan }: { plan: PlanItem }) {
  const featuredClass = plan.featured
    ? "relative rounded-2xl border border-blue-500/40 bg-brand-dark p-6 text-left shadow-lg shadow-blue-900/20 hover:z-[999]"
    : "rounded-2xl border border-zinc-800 bg-brand-dark p-6 text-left";

  const borderClass = plan.name === "Free" ? "border-zinc-700" : "";

  return (
    <div className={cn("plano-hover transition-all duration-300", plan.desktopWrapperClass)}>
      <div className={cn(featuredClass, borderClass, plan.widthClass)}>
        {plan.badge ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs text-white">
            {plan.badge}
          </span>
        ) : null}

        <span className={cn("font-bold", plan.accentClass)}>{plan.name}</span>

        <h3 className="mt-2 text-2xl font-bold text-white">
          {plan.price}
          <span className="text-sm text-zinc-400">/mês</span>
        </h3>

        <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>

        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {plan.features.map((feature) => (
            <PlanFeature key={feature} solid={plan.solidCheck}>
              {feature}
            </PlanFeature>
          ))}
        </ul>

        <button
          className={cn(
            "mt-6 w-full rounded-xl py-2 font-semibold text-white transition",
            plan.featured ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90" : "bg-zinc-800 hover:bg-zinc-700",
          )}
        >
          {plan.cta}
        </button>
      </div>
    </div>
  );
}

export function NichesSection() {
  const [activePlanIndex, setActivePlanIndex] = useState(2);
  const mobilePlansRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number>(0);
  const planCount = PLAN_ITEMS.length;

  const getNearestPlanIndex = (container: HTMLDivElement) => {
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-plan-index]"));
    if (!cards.length) return null;

    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let nextIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(containerCenter - cardCenter);

      if (distance < minDistance) {
        minDistance = distance;
        nextIndex = Number(card.dataset.planIndex);
      }
    });

    return nextIndex;
  };

  const scrollToPlan = (index: number, behavior: ScrollBehavior = "smooth") => {
    const container = mobilePlansRef.current;
    const card = container?.querySelector<HTMLElement>(`[data-plan-index="${index}"]`);
    if (!container || !card) return;

    const targetLeft = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const nextScrollLeft = Math.min(Math.max(targetLeft, 0), maxScrollLeft);

    container.scrollTo({ left: nextScrollLeft, behavior });
    setActivePlanIndex((current) => (current === index ? current : index));
  };

  useEffect(() => {
    const container = mobilePlansRef.current;
    if (!container) return;

    scrollToPlan(activePlanIndex, "auto");
  }, [activePlanIndex]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const goToPlan = (index: number) => {
    const normalizedIndex = (index + planCount) % planCount;
    scrollToPlan(normalizedIndex);
  };

  return (
    <section id="planos" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <section className="w-full px-6">
            <div className="mx-auto max-w-6xl text-center">
              <h2 className="text-3xl font-bold text-white md:text-4xl">Voce cria quantos projetos quiser</h2>

              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-zinc-400">
                Cada projeto pode ter o proprio plano, de acordo com o volume e a fase da sua operacao. Assim voce comeca leve, escala so onde fizer sentido e mantem o controle do custo com mais clareza.
              </p>

              <div className="mt-14 px-1 md:hidden">
                <div
                  ref={mobilePlansRef}
                  className="flex snap-x snap-mandatory gap-0 overflow-x-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none", scrollPaddingInline: "1rem" }}
                  onScroll={(event) => {
                    const container = event.currentTarget;

                    cancelAnimationFrame(scrollFrameRef.current);
                    scrollFrameRef.current = window.requestAnimationFrame(() => {
                      const nextIndex = getNearestPlanIndex(container);
                      if (nextIndex === null) return;

                      setActivePlanIndex((current) => (current === nextIndex ? current : nextIndex));
                    });
                  }}
                >
                  {PLAN_ITEMS.map((plan, index) => (
                    <div key={plan.name} data-plan-index={index} className="w-full shrink-0 snap-center snap-always px-2 first:pl-0 last:pr-0">
                      <PlanCard plan={plan} active={index === activePlanIndex} mobile />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="Plano anterior"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => goToPlan(activePlanIndex - 1)}
                  >
                    <ChevronRight size={16} className="rotate-180" />
                  </button>

                  <div className="flex justify-center gap-2">
                    {PLAN_ITEMS.map((plan, index) => (
                      <button
                        key={plan.name}
                        type="button"
                        aria-label={`Ir para plano ${plan.name}`}
                        className={cn(
                          "h-2.5 rounded-full transition-all duration-300",
                          index === activePlanIndex ? "w-8 bg-cyan-400" : "w-2.5 bg-zinc-700",
                        )}
                        onClick={() => goToPlan(index)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    aria-label="Próximo plano"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => goToPlan(activePlanIndex + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-19 hidden items-end justify-center -space-x-7 md:flex">
                {PLAN_ITEMS.map((plan) => (
                  <DesktopPlanCard key={plan.name} plan={plan} />
                ))}
              </div>
            </div>
          </section>
          <p className="mt-15 font-semibold text-slate-400">Soluções adaptadas para diferentes nichos de mercado.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {NICHE_ITEMS.map((item) => (
            <div
              key={item.label}
              className="group cursor-default rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center transition-all hover:bg-white/[0.05]"
            >
              <div className="mb-4 flex justify-center text-slate-400 transition-colors group-hover:text-blue-400">
                <item.icon size={32} strokeWidth={1.5} />
              </div>
              <h4 className="text-sm font-medium text-slate-100/88">{item.label}</h4>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
