"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import {
  BENEFIT_ITEMS,
  DEMO_FEATURES,
  FOOTER_COMPANY_LINKS,
  FOOTER_SOLUTION_LINKS,
  NICHE_ITEMS,
  PROCESS_STEPS,
  SERVICE_ITEMS,
  TECH_STACK,
  USE_CASE_ITEMS,
  WHATSAPP_NUMBER,
} from "@/app/_components/home/data";
import { PremiumHomeChatDemo } from "@/app/_components/home/chat-demo-premium";
import { cn } from "@/lib/utils";

const FOOTER_LINK_TARGETS: Record<string, string> = {
  "Automações": "/#servicos",
  Sistemas: "/#servicos",
  IA: "/#demonstracao",
  "API integrations": "/#servicos",
  "Sobre nós": "/#demonstracao",
  Privacidade: "/#contato",
  Contato: "/#contato",
  Carreiras: "/#contato",
};

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
    features: ["até 10.000 créditos de IA", "1 agentes", "1 APIs", "1 WhatsApp"],
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
    features: ["até 50.000 créditos de IA", "1 agente", "1 API", "1 WhatsApp"],
    cta: "Começar agora",
    widthClass: "w-[260px]",
    desktopWrapperClass:
      "scale-95 opacity-100 z-20 -translate-y-2 hover:scale-105 hover:z-[999]",
    accentClass: "text-gradient",
  },
  {
    name: "Pro",
    price: "R$ 79,90",
    description: "Melhor custo benefício",
    features: ["até 200.000 créditos de IA", "3 agentes", "5 APIs", "1 WhatsApp"],
    cta: "Começar agora →",
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
    features: ["até 500.000 créditos de IA", "10 agentes", "30 APIs", "10 WhatsApp"],
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
    features: ["até 1.500.000 créditos", "30 agentes", "100 APIs", "20 WhatsApp"],
    cta: "Começar agora",
    widthClass: "w-[240px]",
    desktopWrapperClass:
      "scale-90 opacity-70 z-10 -translate-y-2 hover:scale-100 hover:opacity-100 hover:z-[999]",
    accentClass: "text-gradient",
    solidCheck: true,
  },
];

function PlanCard({ plan, active = false, mobile = false }: { plan: PlanItem; active?: boolean; mobile?: boolean }) {
  const isFeatured = plan.featured || active;

  return (
    <div
      className={cn(
        "relative rounded-2xl bg-brand-dark p-6 text-left transition-all duration-300",
        mobile ? "w-full max-w-none overflow-hidden pt-10" : plan.widthClass,
        isFeatured
          ? "border border-blue-500/40 shadow-lg shadow-blue-900/20"
          : "border border-zinc-800",
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
          <li key={feature} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                plan.solidCheck ? "bg-cyan-400 text-black" : "bg-cyan-400/20 text-cyan-300",
              )}
            >
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <button
        className={cn(
          "mt-6 w-full rounded-xl py-2 font-semibold text-white transition",
          isFeatured
            ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90"
            : "bg-zinc-800 hover:bg-zinc-700",
        )}
      >
        {plan.cta}
      </button>
      </div>
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: (typeof SERVICE_ITEMS)[number]["icon"];
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="glass-effect group rounded-2xl p-8 transition-all duration-300 hover:border-blue-500/50"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110">
        <Icon size={24} />
      </div>
      <h3 className="mb-3 text-xl font-semibold text-slate-100/88">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </motion.div>
  );
}

export function HeroSection({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 md:pb-32 md:pt-48">
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-7xl -translate-x-1/2">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          Tecnologia de ponta e automação inteligente
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
            className="mb-8 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-7xl md:font-semibold"
        >
          Crie um atendente com IA <br className="hidden md:block" /> e coloque ele{" "}
          <span className="text-gradient">onde quiser</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-12 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl"
        >
          Responda clientes automaticamente no WhatsApp, site ou sistema.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onOpenChat();
            }}
            className="inline-flex rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 font-medium text-slate-100/88 shadow-md shadow-blue-600/20 transition-all hover:-translate-y-1 hover:from-blue-500 hover:to-blue-400"
          >
            Criar meu atendente
          </a>
          <a
            href="#demonstracao"
            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-medium text-slate-100/88 transition-all hover:bg-white/10"
          >
            Ver funcionando
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-24"
        >
          <div className="mx-auto max-w-6xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="tech-marquee flex w-max items-center gap-3 py-4">
              {[...TECH_STACK, ...TECH_STACK].map((tech, index) => (
                <span
                  key={`${tech}-${index}`}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400 transition-all duration-300 hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  return (
    <section id="servicos" className="bg-slate-900/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-20 text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-slate-100/88 md:text-[2.35rem]">Soluções técnicas</h2>
          <p className="text-slate-400">
            Para conectar, automatizar e expandir a operação quando você precisar ir além do atendimento.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_ITEMS.map((item) => (
            <ServiceCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function DemoSection() {
  return (
    <section id="demonstracao" className="relative overflow-hidden py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-20 lg:flex-row">
          <div className="lg:w-1/2">
            <h2 className="mb-8 text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-100/88 md:text-[2.8rem]">
              Veja um atendente funcionando
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-slate-400">
              Veja na prática como o atendimento pode responder com rapidez, manter contexto e continuar a conversa nos
              canais certos.
            </p>

            <div className="space-y-6">
              {DEMO_FEATURES.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-blue-500/30"
                >
                  <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-slate-100/88">{item.title}</h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full justify-center lg:w-1/2 lg:justify-end">
            <PremiumHomeChatDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section className="border-y border-white/5 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-12 lg:grid-cols-4">
          {BENEFIT_ITEMS.map((item) => (
            <div key={item.title} className="group text-center">
              <div className="mb-6 flex justify-center text-blue-500 transition-transform group-hover:scale-110">
                <item.icon size={40} strokeWidth={1.5} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100/88">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProcessSection() {
  return (
    <section id="como-funciona" className="bg-slate-900/20 py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-20 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-100/88 md:text-[2.35rem]">Como funciona</h2>
        </div>

        <div className="relative">
          <div className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent lg:block" />

          <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-3">
            {PROCESS_STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-white/10 bg-brand-dark p-8 text-center transition-colors hover:border-blue-500/30"
              >
                <div
                  className={cn(
                    "mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full font-medium text-slate-100/88 shadow-lg",
                    step.highlight ? "bg-emerald-500 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-600/20",
                  )}
                >
                  {step.n}
                </div>
                <h4 className="mb-3 font-medium text-slate-100/88">{step.title}</h4>
                <p className="text-xs leading-relaxed text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section id="onde-usar" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-20 text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-slate-100/88 md:text-[2.35rem]">Onde você pode usar</h2>
          <p className="text-slate-400">
            O mesmo atendente pode trabalhar em canais diferentes sem mudar a experiência visual da sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {USE_CASE_ITEMS.map((item) => (
            <ServiceCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function NichesSection() {
  const [activePlanIndex, setActivePlanIndex] = useState(2);
  const mobilePlansRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number>(0);
  const planCount = PLAN_ITEMS.length;

  useEffect(() => {
    const container = mobilePlansRef.current;
    const card = container?.querySelector<HTMLElement>(`[data-plan-index="${activePlanIndex}"]`);
    if (!container || !card) return;

    container.scrollLeft = card.offsetLeft;
  }, []);

  const goToPlan = (index: number) => {
    const normalizedIndex = (index + planCount) % planCount;
    const container = mobilePlansRef.current;
    const card = container?.querySelector<HTMLElement>(`[data-plan-index="${normalizedIndex}"]`);

    if (container && card) {
      container.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    }

    setActivePlanIndex(normalizedIndex);
  };

  const goToPreviousPlan = () => goToPlan(activePlanIndex - 1);
  const goToNextPlan = () => goToPlan(activePlanIndex + 1);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <section className="w-full px-6 ">
            <div className="max-w-6xl mx-auto text-center">

              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Escalando sem limites
              </h2>

              <p className="text-zinc-400 mt-3">
              Infraestrutura digital de última geração projetada para empresas que exigem performance, segurança e inovação constante.
              </p>

              <div className="mt-12 px-1 md:hidden">
                <div
                  ref={mobilePlansRef}
                  className="flex snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none" }}
                  onScroll={(event) => {
                    cancelAnimationFrame(scrollFrameRef.current);
                    scrollFrameRef.current = window.requestAnimationFrame(() => {
                      const container = event.currentTarget;
                      const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-plan-index]"));
                      if (!cards.length) return;

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

                      setActivePlanIndex((current) => (current === nextIndex ? current : nextIndex));
                    });
                  }}
                >
                    {PLAN_ITEMS.map((plan, index) => (
                      <div key={plan.name} data-plan-index={index} className="w-full shrink-0 snap-center px-2">
                        <PlanCard plan={plan} active={index === activePlanIndex} mobile />
                      </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="Plano anterior"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                    onClick={goToPreviousPlan}
                  >
                    ←
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
                    onClick={goToNextPlan}
                  >
                    →
                  </button>
                </div>
              </div>

              {/* GRID */}
              <div className="mt-19 hidden justify-center items-end -space-x-7 md:flex">

                {/* FREE */}
                <div className="plano-hover relative scale-90  -translate-y-2  opacity-100 z-10 transition-all backdrop-brightness-50 duration-300 hover:scale-100 hover:opacity-100 hover:z-[999]">
                  <div className="rounded-2xl border border-zinc-700 bg-brand-dark  p-6 text-left w-[240px]">

                    <span className=" text-emerald-500 font-bold">Free</span>

                    <h3 className="text-white text-2xl font-bold mt-2">
                      R$ 0
                      <span className="text-sm text-zinc-400">/mês</span>
                    </h3>

                    <p className="text-zinc-400 text-sm mt-2">
                      Ideal para testar
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        até 10.000 créditos de IA
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 agentes
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 APIs
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 WhatsApp
                      </li>
                    </ul>

                    <button className="w-full mt-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white py-2 font-semibold transition">
                      Testar grátis
                    </button>
                  </div>
                </div>

                {/* STARTER */}
                <div className="plano-hover scale-95  opacity-100 z-20 -translate-y-2 transition-all duration-300 hover:scale-105  hover:opacity-100 hover:z-[999]">
                  <div className="rounded-2xl border border-zinc-800 bg-brand-dark p-6 text-left w-[260px]">

                    <span className="text-gradient font-bold">Starter</span>

                    <h3 className="text-white text-2xl font-bold mt-2">
                      R$ 29,90
                      <span className="text-sm text-zinc-400">/mês</span>
                    </h3>

                    <p className="text-zinc-400 text-sm mt-2">
                      Ideal para começar
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        até 50.000 créditos de IA
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 agente
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 API
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 WhatsApp
                      </li>
                    </ul>

                    <button className="w-full mt-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white py-2 font-semibold transition">
                      Começar agora
                    </button>
                  </div>
                </div>

                {/* PRO (CENTRO) */}
                <div className="plano-hover scale-100 z-30 -translate-y-2 transition-all duration-300 hover:scale-115">
                  <div className="relative rounded-2xl border border-blue-500/40 bg-brand-dark p-6 text-left w-[250px] shadow-lg shadow-blue-900/20 hover:z-[999]">

                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-blue-600 px-3 py-1 rounded-full text-white">
                      MAIS USADO
                    </span>

                    <span className="text-gradient font-bold">Pro</span>

                    <h3 className="text-white text-2xl font-bold mt-2">
                      R$ 79,90
                      <span className="text-sm text-zinc-400">/mês</span>
                    </h3>

                    <p className="text-zinc-400 text-sm mt-2">
                      Melhor custo benefício
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        até 200.000 créditos de IA
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        3 agentes
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        5 APIs
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        1 WhatsApp
                      </li>
                    </ul>

                    <button className="w-full mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2 font-semibold hover:opacity-90 transition">
                      Começar agora →
                    </button>
                  </div>
                </div>

                {/* BUSINESS */}
                <div className="plano-hover scale-95 opacity-100 z-20 -translate-y-2 translate-x-2  transition-all duration-300 hover:scale-100 hover:opacity-100 hover:z-[999]">
                  <div className="rounded-2xl border border-zinc-800 bg-brand-dark p-6 text-left w-[260px]">

                    <span className="text-gradient font-bold">Business</span>

                    <h3 className="text-white text-2xl font-bold mt-2">
                      R$ 149,90
                      <span className="text-sm text-zinc-400">/mês</span>
                    </h3>

                    <p className="text-zinc-400 text-sm mt-2">
                      Escalando
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        até 500.000 créditos de IA
                      </li>

                      

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        10 agentes
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        30 APIs
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        10 WhatsApp
                      </li>
                    </ul>

                    <button className="w-full mt-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white py-2 font-semibold transition">
                      Começar agora
                    </button>
                  </div>
                </div>

                {/* SCALE */}
                <div className="plano-hover scale-90 opacity-70 z-10 -translate-y-2  transition-all duration-300 hover:scale-100 hover:opacity-100 hover:z-50 hover:z-[999]">
                  <div className="rounded-2xl border border-zinc-800 bg-brand-dark  p-6 text-left w-[240px]">

                    <span className="text-gradient font-bold">Scale</span>

                    <h3 className="text-white text-2xl font-bold mt-2">
                      R$ 299,90
                      <span className="text-sm text-zinc-400">/mês</span>
                    </h3>

                    <p className="text-zinc-400 text-sm mt-2">
                      Top
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-[10px] text-black font-bold">✓</span>
                        até 1.500.000 créditos 
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        30 agentes
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        100 APIs
                      </li>

                      <li className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[10px] text-cyan-300 font-bold">✓</span>
                        20 WhatsApp
                      </li>
                    </ul>

                    <button className="w-full mt-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white py-2 font-semibold transition">
                      Começar agora
                    </button>
                  </div>
                </div>

                </div>
            </div>
          </section>
          <p className="text-slate-400 mt-15 font-semibold ">Soluções adaptadas para diferentes nichos de mercado.</p>
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

export function ContactSection() {
  return (
    <section id="contato" className="px-4 py-32">
      <div className="mx-auto max-w-5xl">
        <div className="glass-effect relative overflow-hidden rounded-[40px] p-12 text-center shadow-2xl md:p-20">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />

          <h2 className="mb-8 text-3xl font-semibold tracking-[-0.04em] text-slate-100/88 md:text-5xl">Pronto para o próximo nível?</h2>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
            Fale sobre sua ideia e receba uma proposta personalizada sem compromisso. Nosso time técnico entrará em
            contato.
          </p>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-2xl bg-[#25D366] px-10 py-5 text-xl font-semibold text-white shadow-2xl shadow-[#25D366]/20 transition-all hover:scale-105 hover:bg-[#20ba59]"
          >
            <Smartphone size={24} />
            Chamar no WhatsApp
          </a>
          <p className="mt-8 text-sm font-medium text-slate-500">Respostas em menos de 1 hora em horário comercial.</p>
        </div>
      </div>
    </section>
  );
}

export function FooterSection() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-brand-dark py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="max-w-sm">
            <div className="mb-6 flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
              <span className="text-xl font-bold tracking-tight text-white">InfraStudio</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              Tecnologia sob medida para acelerar negócios brasileiros com inteligência e automação.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-20">
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold uppercase tracking-widest text-white">Soluções</span>
              <nav className="flex flex-col gap-3">
                {FOOTER_SOLUTION_LINKS.map((link) => (
                  <a
                    key={link}
                    href={FOOTER_LINK_TARGETS[link] ?? "/"}
                    className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                  >
                    {link}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold uppercase tracking-widest text-white">Empresa</span>
              <nav className="flex flex-col gap-3">
                {FOOTER_COMPANY_LINKS.map((link) => (
                  <a
                    key={link}
                    href={FOOTER_LINK_TARGETS[link] ?? "/"}
                    className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                  >
                    {link}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-xs font-medium text-slate-600 md:flex-row">
          <p>{`© ${new Date().getFullYear()} InfraStudio. Todos os direitos reservados.`}</p>
          <div className="flex items-center gap-2">
            Desenvolvido para gerar produtividade.
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </footer>
  );
}
