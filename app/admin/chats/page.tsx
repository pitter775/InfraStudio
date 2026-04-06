"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, MessageSquare } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";

export default function AdminChatsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/projetos");
  }, [router]);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <AdminPageHeader
          eyebrow="Fluxo por projeto"
          eyebrowIcon={<MessageSquare size={14} />}
          title="Os chats agora sao acessados pelo projeto"
          description="Para manter a jornada consistente, o historico e a operacao de chats foram concentrados dentro do workspace de cada projeto."
        />
        <Link
          href="/admin/projetos"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white"
        >
          Abrir projetos
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
