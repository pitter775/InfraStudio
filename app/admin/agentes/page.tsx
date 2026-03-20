"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Bot } from "lucide-react";

export default function AdminAgentesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/projetos");
  }, [router]);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
          <Bot size={14} />
          Fluxo por projeto
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-white">Agentes agora ficam dentro de cada projeto</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Esta area foi descontinuada para evitar redundancia. Escolha um projeto primeiro e, dentro dele, acesse agente, API, widget e chat no mesmo contexto.
        </p>
        <Link
          href="/admin/projetos"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white"
        >
          Ir para projetos
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
