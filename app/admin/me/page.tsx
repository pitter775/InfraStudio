"use client";

import { useEffect, useState } from "react";
import { Mail, Save, UserRound } from "lucide-react";
import { getCurrentProjectUser } from "@/lib/auth";

type ProfileState = {
  nome: string;
  email: string;
  senha: string;
};

export default function AdminMePage() {
  const [form, setForm] = useState<ProfileState>({ nome: "", email: "", senha: "" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentProjectUser();
      if (!user) {
        return;
      }

      setForm({
        nome: user.name,
        email: user.email,
        senha: "",
      });
    };

    void load();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    const response = await fetch("/api/admin/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string; user?: { name: string; email: string } };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel atualizar o perfil.");
      setSaving(false);
      return;
    }

    setForm((current) => ({
      ...current,
      nome: payload.user?.name ?? current.nome,
      email: payload.user?.email ?? current.email,
      senha: "",
    }));
    setSaving(false);
    setFeedback("Perfil atualizado com sucesso.");
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <h1 className="text-4xl font-extrabold text-white">Meu Perfil</h1>
      </section>

      {feedback ? <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      <section className="max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300"><UserRound size={15} />Nome</span>
            <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300"><Mail size={15} />Email</span>
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-300">Senha</span>
            <input type="password" value={form.senha} onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))} placeholder="Preencha apenas se quiser trocar" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
          </label>
          <div>
            <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
