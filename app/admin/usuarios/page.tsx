"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Lock, Shield, Users } from "lucide-react";
import { mockUsers, type MockUser } from "@/lib/mock-users";

const SESSION_KEY = "infrastudio-auth-user";

export default function AdminUsuariosPage() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(SESSION_KEY);
    if (!storedUser) {
      return;
    }

    try {
      setCurrentUser(JSON.parse(storedUser) as MockUser);
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const isAllowed = currentUser?.role === "admin";

  return (
    <main className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
          <Users size={14} />
          Usuarios mockados
        </div>
        <h1 className="text-4xl font-extrabold text-white">Gestao de usuarios</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Esta pagina simula a listagem administrativa que depois sera abastecida pela tabela `usuarios` conectada ao Supabase.
        </p>
      </section>

      <div>
        {!currentUser ? (
          <div className="rounded-[32px] border border-amber-500/20 bg-amber-500/10 p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
              <Lock size={14} />
              Acesso bloqueado
            </div>
            <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
            <p className="mt-3 max-w-xl text-slate-300">
              Volte para a home, abra o modal de login e entre com o usuario demo para visualizar a experiencia completa.
            </p>
          </div>
        ) : !isAllowed ? (
          <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
              <Shield size={14} />
              Permissao insuficiente
            </div>
            <h2 className="text-2xl font-bold text-white">Seu perfil nao tem acesso administrativo</h2>
            <p className="mt-3 max-w-xl text-slate-300">
              Quando conectarmos ao Supabase, esta liberacao vai depender do papel salvo na tabela `usuarios`.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-7">
                <h2 className="text-2xl font-bold text-white">Resumo do painel</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuarios</p>
                    <p className="mt-2 text-3xl font-extrabold text-white">{mockUsers.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Perfil ativo</p>
                    <p className="mt-2 text-3xl font-extrabold text-white">{currentUser.role}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-emerald-500/20 bg-emerald-500/10 p-7">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                  <BadgeCheck size={14} />
                  Pronto para integrar
                </div>
                <p className="leading-relaxed text-emerald-50">
                  Depois vamos trocar este mock por consulta real ao Supabase: autentica no Auth, busca o registro na tabela
                  `usuarios` e monta as permissoes a partir do papel.
                </p>
              </div>

              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ir para dashboard mockado
              </Link>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <h3 className="text-xl font-bold text-white">Tabela visual de usuarios</h3>
                <p className="mt-1 text-sm text-slate-400">Mock para a futura ligacao com o banco.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Nome</th>
                      <th className="px-6 py-4 font-semibold">Email</th>
                      <th className="px-6 py-4 font-semibold">Role</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map((user) => (
                      <tr key={user.id} className="border-t border-white/5 text-sm text-slate-300">
                        <td className="px-6 py-4 font-semibold text-white">{user.name}</td>
                        <td className="px-6 py-4">{user.email}</td>
                        <td className="px-6 py-4">{user.role}</td>
                        <td className="px-6 py-4">{user.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
