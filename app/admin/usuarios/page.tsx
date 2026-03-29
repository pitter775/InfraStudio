"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Lock, Pencil, Plus, Shield, Trash2, UserRound, Users } from "lucide-react";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getCurrentProjectUser, listProjectUsers } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type UsuarioFormState = {
  id?: string;
  nome: string;
  email: string;
  senha: string;
  ativo: boolean;
  papel: "admin" | "viewer";
  projetoId?: string | null;
};

type ProjetoOption = {
  id: string;
  nome: string;
};

const emptyForm: UsuarioFormState = {
  nome: "",
  email: "",
  senha: "",
  ativo: true,
  papel: "viewer",
  projetoId: null,
};

export default function AdminUsuariosPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<ProjetoOption[]>([]);
  const [form, setForm] = useState<UsuarioFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);

      if (!canAccessGlobalAdmin(user)) {
        return;
      }

      const [projectUsers, projectsPayload] = await Promise.all([
        listProjectUsers(),
        fetch("/api/admin/projetos", { cache: "no-store" }).then((response) => response.json()),
      ]);

      setUsers(projectUsers);
      setProjects((projectsPayload.projetos ?? []).map((project: { id: string; nome: string }) => ({ id: project.id, nome: project.nome })));
    };

    void loadData();
  }, []);

  const isAllowed = canAccessGlobalAdmin(currentUser);

  const refreshUsers = async () => {
    setUsers(await listProjectUsers());
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    if (!form.projetoId) {
      setFeedback("Selecione um projeto para vincular o usuario.");
      setSaving(false);
      return;
    }

    const method = form.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/usuarios", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível salvar o usuário.");
      setSaving(false);
      return;
    }

    await refreshUsers();
    setForm(emptyForm);
    setSaving(false);
    setFeedback(form.id ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.");
  };

  const handleEdit = (user: AppUser) => {
    setForm({
      id: user.id,
      nome: user.name,
      email: user.email,
      senha: "",
      ativo: user.status === "ativo",
      papel: user.role === "admin" ? "admin" : "viewer",
      projetoId: user.memberships?.[0]?.projetoId ?? currentUser?.currentProjectId ?? null,
    });
    setFeedback(null);
  };

  const handleDelete = async (user: AppUser) => {
    const confirmed = window.confirm(`Excluir o usuário ${user.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível excluir o usuário.");
      return;
    }

    await refreshUsers();
    setFeedback("Usuário excluído com sucesso.");
  };

  const handleToggleStatus = async (user: AppUser) => {
    const response = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ativo: user.status !== "ativo" }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível alterar o status.");
      return;
    }

    await refreshUsers();
    setFeedback(`Status de ${user.name} atualizado.`);
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
          <Users size={14} />
          Usuários
        </div>
        <h1 className="text-4xl font-extrabold text-white">Gestão de usuários</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Cadastre, edite, ative ou remova usuários da aplicação diretamente pela tabela `usuarios`.
        </p>
      </section>

      <div>
        {!currentUser ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
              <Lock size={14} />
              Acesso bloqueado
            </div>
            <h2 className="text-2xl font-bold text-white">Você ainda não fez login</h2>
            <p className="mt-3 max-w-xl text-slate-300">
              Volte para a home, abra o modal de login e entre com um usuário autorizado para visualizar a experiência
              completa.
            </p>
          </div>
        ) : !isAllowed ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
              <Shield size={14} />
              Permissão insuficiente
            </div>
            <h2 className="text-2xl font-bold text-white">Seu perfil não tem acesso administrativo</h2>
            <p className="mt-3 max-w-xl text-slate-300">
              Neste momento, o painel libera acesso apenas para o usuário master configurado na aplicação.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{form.id ? "Editar usuário" : "Novo usuário"}</h2>
                    <p className="mt-1 text-sm text-slate-400">Crie acessos próprios da aplicação sem depender do Auth externo.</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/15 bg-blue-500/10 p-3 text-blue-200">
                    <UserRound size={20} />
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    value={form.nome}
                    onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Nome completo"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="email@dominio.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={form.senha}
                    onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))}
                    placeholder={form.id ? "Nova senha (opcional)" : "Senha inicial"}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">Perfil</span>
                    <select
                      value={form.papel}
                      onChange={(event) => setForm((prev) => ({ ...prev, papel: event.target.value as "admin" | "viewer" }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                    >
                      <option value="viewer">Usuario comum</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">Projeto</span>
                    <select
                      value={form.projetoId ?? ""}
                      onChange={(event) => setForm((prev) => ({ ...prev, projetoId: event.target.value || null }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                    >
                      <option value="">Selecione um projeto</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                    />
                    Usuário ativo
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
                    >
                      {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                      {saving ? "Salvando..." : form.id ? "Atualizar usuário" : "Criar usuário"}
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

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-7">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                  <BadgeCheck size={14} />
                  Operações ativas
                </div>
                <p className="leading-relaxed text-emerald-50">
                  O CRUD já cria senha com hash bcrypt, atualiza cadastro, alterna status e remove vínculos em
                  `usuarios_projetos` antes de excluir o usuário.
                </p>
              </div>

              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ir para dashboard
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <h3 className="text-xl font-bold text-white">Usuários cadastrados</h3>
                <p className="mt-1 text-sm text-slate-400">Clique em editar para carregar os dados no formulário ao lado.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Nome</th>
                      <th className="px-6 py-4 font-semibold">Email</th>
                      <th className="px-6 py-4 font-semibold">Perfil</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-white/5 text-sm text-slate-300">
                        <td className="px-6 py-4 font-semibold text-white">{user.name}</td>
                        <td className="px-6 py-4">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isMaster ? "bg-amber-500/15 text-amber-300" : user.role === "admin" ? "bg-cyan-500/15 text-cyan-200" : "bg-slate-800 text-slate-300"}`}>
                            {user.isMaster ? "master" : user.role === "admin" ? "admin" : "comum"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(user)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              user.status === "ativo"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {user.status}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2 text-amber-100 transition-colors hover:bg-amber-500/20 hover:text-white"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(user)}
                              className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-200"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
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
