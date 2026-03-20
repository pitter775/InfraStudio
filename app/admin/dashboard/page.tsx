"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Bot, Clock3, Layers3, Users } from "lucide-react";
import { listProjectUsers } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

const recentEvents = [
  "Novo lead captado via WhatsApp imobiliario.",
  "Usuario admin revisou permissoes de equipe.",
  "Fluxo de agendamento disparou 14 mensagens.",
  "Dashboard consolidou indicadores do dia.",
];

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      setUsers(await listProjectUsers());
    };

    void loadUsers();
  }, []);

  const stats = [
    { label: "Usuarios", value: String(users.length), detail: "Tabela `usuarios` ou modo demo", icon: Users },
    { label: "Leads no funil", value: "138", detail: "+18 hoje", icon: Layers3 },
    { label: "Automacoes rodando", value: "9", detail: "3 criticas", icon: Bot },
    { label: "Tempo medio", value: "1m 42s", detail: "-22% resposta", icon: Clock3 },
  ];

  return (
    <main className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="px-1 py-2">
          <div className="infra-premium-pill mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
            <Activity size={14} />
            Dashboard integrado
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-[2.8rem]">Visao geral da operacao</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-400">
            Esta tela antecipa o tom do backoffice da InfraStudio: indicadores, fluxo recente e atalhos em uma
            experiencia mais refinada, com cara de produto premium.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="infra-premium-panel infra-premium-hover rounded-[24px] p-5">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/24 to-cyan-400/10 text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
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

        <div className="infra-premium-panel rounded-[28px] bg-[linear-gradient(180deg,rgba(14,165,233,0.18),rgba(8,15,32,0.92))] p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/24 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <ArrowUpRight size={22} />
          </div>
          <h2 className="text-2xl font-bold text-white">Proximo passo</h2>
          <p className="mt-4 leading-7 text-cyan-50/92">
            Na evolucao do produto, este dashboard vai puxar dados reais do banco da aplicacao e respeitar permissoes
            vindas de `usuarios_projetos`, sem abrir mao do acabamento premium da InfraStudio.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="infra-premium-panel overflow-hidden rounded-[28px]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">Eventos recentes</h2>
            <p className="mt-1 text-sm text-slate-400">Linha do tempo visual para acompanhar o ritmo da operacao.</p>
          </div>

          <div className="space-y-4 p-6">
            {recentEvents.map((event, index) => (
              <div key={event} className="infra-premium-hover flex gap-4 rounded-2xl border border-white/8 bg-slate-950/26 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/24 to-cyan-400/12 text-blue-100">
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

        <div className="infra-premium-panel overflow-hidden rounded-[28px]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">Usuarios em destaque</h2>
            <p className="mt-1 text-sm text-slate-400">Resumo rapido da tabela de usuarios.</p>
          </div>

          <div className="space-y-3 p-6">
            {users.map((user) => (
              <div key={user.id} className="infra-premium-hover flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/26 p-4">
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
