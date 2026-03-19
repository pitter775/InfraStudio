"use client";

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
  WHATSAPP_NUMBER,
} from "@/app/_components/home/data";
import { ChatDemo } from "@/app/_components/home/interactive";
import { cn } from "@/lib/utils";

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
      <h3 className="mb-3 text-xl font-bold text-white">{title}</h3>
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
          className="mb-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-7xl"
        >
          Sistemas, automações e IA <br className="hidden md:block" /> para sua empresa{" "}
          <span className="text-gradient">vender mais</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-12 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl"
        >
          Desenvolvemos software sob medida, integrações de APIs e automações inteligentes para WhatsApp e Instagram.
          Menos esforço manual, mais resultados escaláveis.
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
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 font-bold text-white shadow-xl shadow-blue-600/20 transition-all hover:-translate-y-1 hover:from-blue-500 hover:to-blue-400 sm:w-auto"
          >
            Solicitar orçamento grátis
          </a>
          <a
            href="#demonstracao"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
          >
            Ver demonstração
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
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Soluções para a era da eficiência</h2>
          <p className="text-slate-400">Tudo o que você precisa para digitalizar e escalar sua operação.</p>
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
            <h2 className="mb-8 text-3xl font-extrabold leading-tight text-white md:text-5xl">
              A experiência é a nossa maior prova.
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-slate-400">
              Não apenas falamos sobre tecnologia, nós a vivemos. Esta página e nossos sistemas são construídos com a
              mesma excelência que entregamos aos nossos clientes.
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
                    <h4 className="mb-1 font-bold text-white">{item.title}</h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full justify-center lg:w-1/2 lg:justify-end">
            <ChatDemo />
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
              <h3 className="mb-2 text-lg font-bold text-white">{item.title}</h3>
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
          <h2 className="text-3xl font-bold text-white md:text-4xl">Do problema à eficiência em 5 passos</h2>
        </div>

        <div className="relative">
          <div className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent lg:block" />

          <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-5">
            {PROCESS_STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-white/10 bg-brand-dark p-8 text-center transition-colors hover:border-blue-500/30"
              >
                <div
                  className={cn(
                    "mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full font-bold text-white shadow-lg",
                    step.highlight ? "bg-emerald-500 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-600/20",
                  )}
                >
                  {step.n}
                </div>
                <h4 className="mb-3 font-bold text-white">{step.title}</h4>
                <p className="text-xs leading-relaxed text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function NichesSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Feito para quem busca escala</h2>
          <p className="text-slate-400">Soluções adaptadas para diferentes nichos de mercado.</p>
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
              <h4 className="text-sm font-bold text-white">{item.label}</h4>
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

          <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-white md:text-6xl">Pronto para o próximo nível?</h2>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
            Fale sobre sua ideia e receba uma proposta personalizada sem compromisso. Nosso time técnico entrará em
            contato.
          </p>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-2xl bg-[#25D366] px-10 py-5 text-xl font-extrabold text-white shadow-2xl shadow-[#25D366]/20 transition-all hover:scale-105 hover:bg-[#20ba59]"
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
                  <a key={link} href="#" className="text-sm text-slate-500 transition-colors hover:text-blue-400">
                    {link}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold uppercase tracking-widest text-white">Empresa</span>
              <nav className="flex flex-col gap-3">
                {FOOTER_COMPANY_LINKS.map((link) => (
                  <a key={link} href="#" className="text-sm text-slate-500 transition-colors hover:text-blue-400">
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
