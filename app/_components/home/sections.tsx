"use client";

import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import {
  BENEFIT_ITEMS,
  DEMO_FEATURES,
  FOOTER_COMPANY_LINKS,
  FOOTER_SOLUTION_LINKS,
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

function UseCaseCard({
  icon: Icon,
  title,
  description,
  salesPitch,
  delay,
  backgroundImage,
  backgroundPosition = "center center",
  glowColor,
}: (typeof USE_CASE_ITEMS)[number]) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="group relative min-h-[520px] overflow-hidden rounded-[28px] bg-transparent transition-all duration-300 ease-out hover:-translate-y-1"
    >
      <div
        className="absolute inset-0 scale-[1.06] bg-cover bg-no-repeat blur-[2px] saturate-[0.96] transition-all duration-500 ease-out group-hover:scale-[1.1] group-hover:brightness-110"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundPosition,
        }}
      />
      {/* <div className="absolute inset-0 bg-black/16" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.42),rgba(0,0,0,0.18),rgba(0,0,0,0.02))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%)] opacity-30" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#020817]/58 via-[#020817]/22 to-transparent" /> */}

      <div className="relative z-10 flex h-full flex-col justify-between p-7">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/18 text-[#f8fafc] backdrop-blur-xl transition-transform duration-300 group-hover:scale-[1.04]"
          style={{
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04)`,
          }}
        >
          <Icon size={24} />
        </div>

        <div className="max-w-[18rem] rounded-3xl bg-black/12 p-5 backdrop-blur-xl">
          <h3
            className="mb-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.04em] text-white"
            style={{ textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}
          >
            {title}
          </h3>
          <p
            className="text-sm leading-7 text-white/92"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.38)" }}
          >
            {description}
          </p>
          <p
            className="mt-4 text-sm font-medium leading-6 text-white"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.38)" }}
          >
            {salesPitch}
          </p>
        </div>
      </div>
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

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
          {USE_CASE_ITEMS.map((item) => (
            <UseCaseCard key={item.title} {...item} />
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



