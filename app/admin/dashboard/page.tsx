"use client";

import { Activity, ArrowUpRight, Bot, Clock3, Layers3, Users } from "lucide-react";
import { mockUsers } from "@/lib/mock-users";

const stats = [
  { label: "Usuarios ativos", value: "24", detail: "+12% este mes", icon: Users },
  { label: "Leads no funil", value: "138", detail: "+18 hoje", icon: Layers3 },
  { label: "Automacoes rodando", value: "9", detail: "3 criticas", icon: Bot },
  { label: "Tempo medio", value: "1m 42s", detail: "-22% resposta", icon: Clock3 },
];

const recentEvents = [
  "Novo lead captado via WhatsApp imobiliario.",
  "Usuario admin revisou permissoes de equipe.",
  "Fluxo de agendamento disparou 14 mensagens.",
  "Dashboard consolidou indicadores do dia.",
];

export default function AdminDashboardPage() {
  return (
    <main className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            <Activity size={14} />
            Dashboard mockado
          </div>
          <h1 className="text-4xl font-extrabold text-white">Visao geral da operacao</h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Esta tela ja antecipa como o backoffice vai ficar: indicadores, fluxo recente e acesso rapido para a
            gestao dos usuarios.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                    <Icon size={22} />
                  </div>
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">{item.value}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[32px] border border-cyan-500/15 bg-cyan-500/10 p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/20 text-cyan-100">
            <ArrowUpRight size={22} />
          </div>
          <h2 className="text-2xl font-bold text-white">Proximo passo</h2>
          <p className="mt-4 leading-relaxed text-cyan-50">
            Na integracao real, este dashboard vai puxar dados do Supabase e respeitar as permissoes vindas da tabela
            `usuarios`.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">Eventos recentes</h2>
            <p className="mt-1 text-sm text-slate-400">Linha do tempo visual para mock do painel.</p>
          </div>

          <div className="space-y-4 p-6">
            {recentEvents.map((event, index) => (
              <div key={event} className="flex gap-4 rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                  0{index + 1}
                </div>
                <div>
                  <p className="font-semibold text-white">{event}</p>
                  <p className="mt-1 text-sm text-slate-400">Atualizado ha poucos instantes.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">Usuarios em destaque</h2>
            <p className="mt-1 text-sm text-slate-400">Resumo rapido da tabela de usuarios mockada.</p>
          </div>

          <div className="space-y-3 p-6">
            {mockUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                <div>
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">{user.role}</p>
                  <p className="text-xs text-emerald-300">{user.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
