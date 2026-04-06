"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Bot } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";

export default function AdminAgentesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/projetos");
  }, [router]);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <AdminPageHeader
          eyebrow="Fluxo por projeto"
          eyebrowIcon={<Bot size={14} />}
          title="Agentes agora ficam dentro de cada projeto"
          description="Esta area foi descontinuada para evitar redundancia. Escolha um projeto primeiro e, dentro dele, acesse agente, API, widget e chat no mesmo contexto."
        />
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
