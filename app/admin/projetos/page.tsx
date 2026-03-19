"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Lock, Pencil, Plus, Shield } from "lucide-react";
import { canAccessAdmin } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Projeto = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
  agentesCount?: number;
  chatsCount?: number;
};

type ProjetoFormState = {
  id?: string;
  nome: string;
  slug: string;
  tipo: string;
  descricao: string;
  status: string;
};

const emptyForm: ProjetoFormState = {
  nome: "",
  slug: "",
  tipo: "",
  descricao: "",
  status: "ativo",
};

export default function AdminProjetosPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [form, setForm] = useState<ProjetoFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [user, response] = await Promise.all([
        getCurrentProjectUser(),
        fetch("/api/admin/projetos", { cache: "no-store" }),
      ]);

      setCurrentUser(user);

      if (response.ok) {
        const payload = (await response.json()) as { projetos?: Projeto[] };
        setProjetos(payload.projetos ?? []);
      }
    };

    void loadData();
  }, []);

  const isAllowed = canAccessAdmin(currentUser);

  const refreshProjetos = async () => {
    const response = await fetch("/api/admin/projetos", { cache: "no-store" });
    const payload = (await response.json()) as { projetos?: Projeto[] };
    setProjetos(payload.projetos ?? []);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    const method = form.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/projetos", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel salvar o projeto.");
      setSaving(false);
      return;
    }

    await refreshProjetos();
    setForm(emptyForm);
    setSaving(false);
    setFeedback(form.id ? "Projeto atualizado com sucesso." : "Projeto criado com sucesso.");
  };

  const handleEdit = (projeto: Projeto) => {
    setForm({
      id: projeto.id,
      nome: projeto.nome,
      slug: projeto.slug ?? "",
      tipo: projeto.tipo ?? "",
      descricao: projeto.descricao,
      status: projeto.status,
    });
    setFeedback(null);
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <BriefcaseBusiness size={14} />
          Projetos
        </div>
        <h1 className="text-4xl font-extrabold text-white">Gestao de projetos</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          O projeto organiza cliente, agentes, chats e conectores. O master cria projetos e depois acopla agentes a cada ambiente.
        </p>
      </section>

      {!currentUser ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            <Lock size={14} />
            Acesso bloqueado
          </div>
          <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
          <p className="mt-3 max-w-xl text-slate-300">Entre com o usuario master para administrar os projetos.</p>
        </div>
      ) : !isAllowed || !currentUser.isMaster ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
            <Shield size={14} />
            Permissao insuficiente
          </div>
          <h2 className="text-2xl font-bold text-white">Somente o master pode gerenciar projetos</h2>
          <p className="mt-3 max-w-xl text-slate-300">Usuarios comuns operam apenas os agentes e chats do proprio projeto.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{form.id ? "Editar projeto" : "Novo projeto"}</h2>
                <p className="mt-1 text-sm text-slate-400">Crie o projeto e depois conecte agentes, chats e integrações.</p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/10 p-3 text-amber-200">
                <BriefcaseBusiness size={20} />
              </div>
            </div>

            <div className="space-y-4">
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Nome do projeto"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="Slug unico do projeto"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.tipo}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                placeholder="Tipo do projeto"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <textarea
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Descricao do projeto"
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
              >
                <option value="ativo">ativo</option>
                <option value="pendente">pendente</option>
                <option value="arquivado">arquivado</option>
              </select>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
                >
                  {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                  {saving ? "Salvando..." : form.id ? "Atualizar projeto" : "Criar projeto"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setFeedback(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
                >
                  Limpar
                </button>
              </div>

              {feedback ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {feedback}
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-bold text-white">Projetos cadastrados</h3>
              <p className="mt-1 text-sm text-slate-400">Selecione um projeto para editar ou usar como base na criacao de agentes.</p>
            </div>
            <div className="space-y-4 p-6">
              {projetos.length ? (
                projetos.map((projeto) => (
                    <div key={projeto.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-bold text-white">{projeto.nome}</h4>
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                            {projeto.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          slug: {projeto.slug ?? "sem-slug"} {projeto.tipo ? `• tipo: ${projeto.tipo}` : ""}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/projetos/${projeto.id}`}
                          className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-100"
                        >
                          Abrir
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleEdit(projeto)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum projeto cadastrado ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
