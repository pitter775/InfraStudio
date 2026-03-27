"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bot, ChevronRight, Database, MessageCircleMore, Sparkles, Store, Workflow } from "lucide-react";

const valueItems = [
  { title: "Responde clientes automaticamente", icon: MessageCircleMore },
  { title: "Funciona direto no seu WhatsApp", icon: Workflow },
  { title: "Usa dados reais da sua loja ou sistema", icon: Database },
] as const;

const steps = [
  "Teste o atendente",
  "Conecte seu WhatsApp",
  "Comece a atender automaticamente",
] as const;

export function HeroSection({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return (
    <section id="hero" className="relative overflow-hidden px-4 pb-14 pt-30 sm:px-6 sm:pb-20 sm:pt-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/16 blur-[100px]" />
        <div className="absolute right-[-4rem] top-24 h-56 w-56 rounded-full bg-cyan-400/12 blur-[110px]" />
        <div className="absolute bottom-0 left-[-3rem] h-52 w-52 rounded-full bg-sky-500/12 blur-[100px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.9)]" />
            Automação com IA
          </div>

          <h1 className="mt-5 text-[2.15rem] font-semibold leading-none tracking-[-0.05em] text-white sm:text-5xl">
            Seu WhatsApp
            <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-cyan-200 to-sky-300 bg-clip-text text-transparent">
              respondendo clientes sozinho
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-slate-300 lg:mx-0 lg:text-base">
            Conectou. Funcionou. Já tá atendendo.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22c55e,#06b6d4)] px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_18px_60px_rgba(6,182,212,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
            >
              Testar grátis agora
              <ChevronRight size={16} />
            </button>

            <a
              href="#cta-final"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              Usar no meu WhatsApp
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 lg:justify-start">
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">Sem setup complicado</div>
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">Respostas em segundos</div>
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">Pronto para operar</div>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[56rem]">
      <div className="absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/10 via-transparent to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-3 shadow-[0_30px_100px_rgba(2,6,23,0.55)] sm:rounded-[32px] sm:p-4">
        <div className="mb-3 flex items-center justify-between rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-2.5 sm:mb-4 sm:rounded-[22px] sm:px-4 sm:py-3">
          <div>
            <p className="text-sm font-semibold text-white">Fluxo dentro do WhatsApp</p>
            <p className="text-[11px] text-emerald-300 sm:text-xs">Visual familiar para o cliente</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 sm:px-3 sm:text-xs">
            <Sparkles size={14} />
            IA ativa
          </div>
        </div>

        <div className="grid min-h-[380px] grid-cols-[120px_1fr] overflow-hidden rounded-[24px] border border-white/8 bg-[#0b141a] sm:min-h-[450px] sm:grid-cols-[152px_1fr] sm:rounded-[28px]">
          <div className="border-r border-white/6 bg-[#111b21]">
            <div className="flex items-center justify-between px-2.5 py-3 sm:px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#233138] text-[10px] font-semibold text-white sm:h-9 sm:w-9 sm:text-[11px]">IS</div>
              <div className="flex items-center gap-1.5 text-slate-400 sm:gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <div className="h-2 w-2 rounded-full bg-slate-600" />
                <div className="h-2 w-2 rounded-full bg-slate-600" />
              </div>
            </div>

            <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
              <div className="rounded-full bg-[#202c33] px-3 py-2 text-[10px] text-slate-400 sm:text-[11px]">Pesquisar</div>
            </div>

            <div className="space-y-1 px-2 pb-2.5 sm:pb-3">
              <div className="rounded-full bg-[#103529] px-3 py-1.5 text-[10px] font-medium text-[#00d757]">Tudo</div>
              <div className="rounded-full border border-white/8 px-3 py-1.5 text-[10px] text-slate-400">Não lidas</div>
            </div>

            <div className="space-y-1 px-1.5 pb-2 sm:space-y-1.5 sm:px-2">
              <div className="rounded-2xl px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#374248] text-[9px] font-semibold text-white sm:h-9 sm:w-9 sm:text-[10px]">
                    NL
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-white sm:text-[11px]">Novo lead</p>
                    <p className="truncate text-[9px] text-slate-400 sm:text-[10px]">Oi, vocês atendem hoje?</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-[#202c33] px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#53bdeb] text-[9px] font-semibold text-slate-950 sm:h-9 sm:w-9 sm:text-[10px]">
                    <Store size={12} className="sm:h-[13px] sm:w-[13px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-white sm:text-[11px]">Loja Demo</p>
                    <p className="truncate text-[9px] text-slate-300 sm:text-[10px]">Você: atendimento automático ativo</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f3b42] text-[9px] font-semibold text-cyan-100 sm:h-9 sm:w-9 sm:text-[10px]">
                    CR
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-white sm:text-[11px]">Cliente recorrente</p>
                    <p className="truncate text-[9px] text-slate-400 sm:text-[10px]">Quero saber o prazo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#0b141a]">
            <div className="flex items-center justify-between border-b border-white/6 bg-[#202c33] px-2.5 py-3 sm:px-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#233138] text-emerald-200 sm:h-10 sm:w-10">
                  <Bot size={16} className="sm:h-[18px] sm:w-[18px]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white sm:text-[15px]">Loja Demo</p>
                  <p className="text-[10px] text-slate-400 sm:text-[12px]">Atendimento automatizado</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 sm:gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-500" />
                <div className="h-2 w-2 rounded-full bg-slate-500" />
                <div className="h-2 w-2 rounded-full bg-slate-500" />
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-between bg-[#0b141a] bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23182129%22 fill-opacity=%220.9%22%3E%3Cpath d=%22M36 34c0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4 4-1.79 4-4zm-18-4c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm26-17c0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4 4-1.79 4-4zM8 10h8v2H8zm38 33h6v2h-6zM22 50h10v2H22zM6 46l5-5 1.4 1.4L7.4 47.4zM47 19l4-4 1.4 1.4-4 4zM17 17l3-3 1.4 1.4-3 3zM41 49l3-3 1.4 1.4-3 3z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] p-3 sm:p-4">
              <div className="space-y-2">
                <div className="max-w-[86%] rounded-[8px] rounded-tl-none bg-[#202c33] px-2.5 py-2.5 text-[11px] leading-4.5 text-[#e9edef] shadow-[0_1px_0_rgba(0,0,0,0.25)] sm:max-w-[78%] sm:px-3 sm:py-3 sm:text-[13px] sm:leading-5">
                  Oi, vocês têm esse produto à pronta entrega?
                  <div className="mt-1 text-right text-[9px] text-slate-400 sm:text-[10px]">09:41</div>
                </div>
                <div className="ml-auto max-w-[92%] rounded-[8px] rounded-tr-none bg-[#005c4b] px-2.5 py-2.5 text-[11px] leading-4.5 text-[#e9edef] shadow-[0_1px_0_rgba(0,0,0,0.25)] sm:max-w-[86%] sm:px-3 sm:py-3 sm:text-[13px] sm:leading-5">
                  Tenho sim. Posso te passar a opção ideal e seguir com seu atendimento agora.
                  <div className="mt-1 text-right text-[9px] text-emerald-100/75 sm:text-[10px]">09:41</div>
                </div>
                <div className="ml-auto max-w-[92%] rounded-[8px] rounded-tr-none bg-[#005c4b] px-2.5 py-2.5 text-[11px] leading-4.5 text-[#e9edef] shadow-[0_1px_0_rgba(0,0,0,0.25)] sm:max-w-[86%] sm:px-3 sm:py-3 sm:text-[13px] sm:leading-5">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-100/70 sm:text-[10px]">
                    IA da sua loja
                  </div>
                  Me fala seu modelo ou pedido e eu continuo daqui automaticamente.
                  <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-emerald-100/75 sm:text-[10px]">
                    <span>09:42</span>
                    <span>✓✓</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-[16px] bg-[#202c33] px-2.5 py-2 sm:rounded-[18px] sm:px-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="text-base leading-none sm:text-lg">+</div>
                  <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[10px] text-slate-400 sm:text-[11px]">Digite uma mensagem</div>
                  <div className="h-4 w-4 rounded-full border border-slate-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ValueSection() {
  return <section id="valor" className="px-4 py-8 sm:px-6 sm:py-10"><div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">{valueItems.map(({ title, icon: Icon }) => <div key={title} className="rounded-[24px] border border-white/8 bg-white/[0.035] p-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 text-emerald-200"><Icon size={18} /></div><p className="text-sm font-medium leading-6 text-white">{title}</p></div>)}</div></section>;
}

export function VisualProofSection() {
  return <section id="prova" className="px-4 py-10 sm:px-6 sm:py-16"><div className="mx-auto max-w-6xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 sm:rounded-[32px] sm:p-7"><div className="mb-8 max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Prova simples</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">O cliente pergunta. A IA responde no mesmo fluxo.</h2></div><div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] sm:gap-6"><div className="rounded-[24px] border border-white/8 bg-[#0b141a] p-5 text-sm text-slate-200 sm:rounded-[28px] sm:p-6">Mock visual do WhatsApp mantido para demonstrar a prova social da automação.</div><div className="grid gap-4"><div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-5 sm:rounded-[28px]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-cyan-100"><Database size={18} /></div><div><p className="text-sm font-medium text-white">Dados reais</p><p className="text-sm text-slate-400">A IA responde com informação da sua operação.</p></div></div></div><div className="rounded-[24px] border border-white/8 bg-white/[0.035] p-5 sm:rounded-[28px]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-emerald-100"><Workflow size={18} /></div><div><p className="text-sm font-medium text-white">Sem trocar de app</p><p className="text-sm text-slate-400">O atendimento continua no WhatsApp que você já usa.</p></div></div></div><div className="rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(6,182,212,0.12))] p-5 sm:rounded-[28px]"><p className="text-sm font-medium text-white">Menos operação, mais resposta.</p><p className="mt-2 text-sm leading-6 text-slate-200">O objetivo aqui é simples: fazer o cliente ser atendido rápido e levar você para o teste.</p></div></div></div></div></section>;
}

export function HowItWorksSection() {
  return <section id="como-funciona" className="px-4 py-10 sm:px-6 sm:py-16"><div className="mx-auto max-w-6xl"><div className="mb-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Como funciona</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Comece em 3 passos</h2></div><div className="grid gap-4 md:grid-cols-3">{steps.map((step, index) => <div key={step} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-center shadow-[0_20px_50px_rgba(2,6,23,0.16)] sm:rounded-[28px] sm:p-6"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 text-lg font-semibold text-white">{index + 1}</div><p className="mt-4 text-base font-medium text-white">{step}</p></div>)}</div></div></section>;
}

export function BeyondWhatsappSection() {
  return <section id="alem-do-whatsapp" className="px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto grid max-w-6xl items-center gap-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.24)] sm:gap-8 sm:rounded-[36px] sm:p-8 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Nova camada de valor</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Vai além do WhatsApp</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Tenha também um site completo com seus produtos, integrado com o mesmo atendente inteligente.</p><div className="mt-6 space-y-3"><div className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white">Seus produtos organizados em um site profissional</div><div className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white">O mesmo atendente funcionando no site e no WhatsApp</div></div><div className="mt-6 max-w-[440px] bg-[linear-gradient(135deg,#a7f3d0,#67e8f9,#fde68a)] bg-clip-text text-sm font-semibold leading-6 tracking-tight text-transparent sm:text-base">O cliente começa no WhatsApp e continua no seu site. Tudo automatizado.</div><AgentStatusCard /></div><AgentExperienceShowcase /></div></section>;
}

function AgentExperienceShowcase() {
  const [showWebsite, setShowWebsite] = useState(true);
  useEffect(() => {
    const intervalId = window.setInterval(() => setShowWebsite((current) => !current), 3200);
    return () => window.clearInterval(intervalId);
  }, []);

  return <div className="relative min-h-[420px] [perspective:1800px] sm:min-h-[540px]"><motion.div animate={{ rotateY: showWebsite ? 0 : 180 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ transformStyle: "preserve-3d" }} className="relative h-full min-h-[420px] sm:min-h-[540px]"><div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] shadow-[0_30px_90px_rgba(2,6,23,0.45)] [backface-visibility:hidden] sm:rounded-[32px]"><WebsiteFace /></div><div className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,26,0.96),rgba(2,6,23,0.98))] shadow-[0_30px_90px_rgba(2,6,23,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-[32px]"><WhatsappFace /></div></motion.div></div>;
}

function AgentStatusCard() {
  return <div className="mt-6 ml-auto max-w-[320px] text-right"><div className="flex items-center justify-end gap-3"><div><p className="text-sm font-semibold text-white">Mesmo agente</p><p className="text-[11px] text-slate-400">Ativo em todos os canais</p></div><div className="flex h-12 w-12 items-center justify-center rounded-xl text-white animate-[agentGlow_4.6s_linear_infinite]"><Bot size={22} strokeWidth={1.9} /></div></div><div className="mt-4 mr-4 space-y-2"><div className="grid grid-cols-[1fr_14px] items-center justify-items-end gap-x-2 px-1 py-1 text-xs text-white"><span>Conectado ao WhatsApp</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><div className="grid grid-cols-[1fr_14px] items-center justify-items-end gap-x-2 px-1 py-1 text-xs text-white"><span>Conectado a APIs</span><span className="h-2 w-2 rounded-full bg-cyan-400" /></div><div className="grid grid-cols-[1fr_14px] items-center justify-items-end gap-x-2 px-1 py-1 text-xs text-white"><span>Conectado ao Mercado Livre</span><span className="h-2 w-2 rounded-full bg-yellow-300" /></div><div className="grid grid-cols-[1fr_14px] items-center justify-items-end gap-x-2 px-1 py-1 text-xs text-white"><span className="whitespace-nowrap">Você personaliza o agente com texto simples</span><span className="h-2 w-2 rounded-full bg-sky-400" /></div></div></div>;
}

function WebsiteFace() {
  return <div className="flex h-full items-center justify-center px-6 pt-20 text-center text-sm text-slate-300 sm:px-8 sm:pt-24">Mock do site com mini chat integrado ao mesmo agente.</div>;
}

function WhatsappFace() {
  return <div className="flex h-full items-center justify-center px-6 pt-20 text-center text-sm text-slate-300 sm:px-8 sm:pt-24">Mock do WhatsApp continuando a mesma conversa do site.</div>;
}

export function FinalCtaSection({ onPrimaryClick }: { onPrimaryClick: () => void }) {
  return <section id="cta-final" className="px-4 pb-16 pt-8 sm:px-6 sm:pb-20"><div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(3,7,18,0.98))] px-5 py-8 text-center shadow-[0_30px_100px_rgba(2,6,23,0.45)] sm:rounded-[32px] sm:px-10 sm:py-10"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/80">CTA final</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Pronto para automatizar seu WhatsApp?</h2><button type="button" onClick={onPrimaryClick} className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22c55e,#06b6d4)] px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_18px_60px_rgba(6,182,212,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110">Testar grátis agora<ChevronRight size={16} /></button></div></section>;
}
