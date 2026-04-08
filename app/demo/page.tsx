"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DemoAgente = {
  nome: string;
  descricao: string;
  prompt_base: string;
};

type DemoApi = {
  nome: string;
  url: string;
  metodo: string;
};

type DemoProjeto = {
  nome: string;
  plano: string;
  agentes: DemoAgente[];
  apis: DemoApi[];
};

const fallbackProjeto: DemoProjeto = {
  nome: "Demonstração",
  plano: "free",
  agentes: [
    {
      nome: "Vendedor de Camisetas",
      descricao: "Agente focado em vendas",
      prompt_base:
        "Você é um vendedor especialista em camisetas. Seja direto, amigável e focado em conversão. Sempre leve para o WhatsApp.",
    },
  ],
  apis: [
    {
      nome: "Produtos Camisetas",
      url: "https://api.escuelajs.co/api/v1/products/?categoryId=2",
      metodo: "GET",
    },
  ],
};

export default function DemoPage() {
  const [projeto, setProjeto] = useState<DemoProjeto | null>(null);
  const projetoAtual = projeto ?? fallbackProjeto;
  const agente = projetoAtual.agentes[0];
  const api = projetoAtual.apis[0];

  useEffect(() => {
    let ativo = true;

    async function carregarProjeto() {
      try {
        const resposta = await fetch("/demo-projeto.json", { cache: "no-store" });

        if (!resposta.ok) {
          return;
        }

        const dados = (await resposta.json()) as DemoProjeto;

        if (ativo) {
          setProjeto(dados);
        }
      } catch {
        // Mantem o fallback local sem depender de backend.
      }
    }

    carregarProjeto();

    return () => {
      ativo = false;
    };
  }, []);

  function atualizarPromptBase(prompt_base: string) {
    setProjeto((atual) => {
      const base = atual ?? fallbackProjeto;

      return {
        ...base,
        agentes: base.agentes.map((item, index) =>
          index === 0
            ? {
                ...item,
                prompt_base,
              }
            : item,
        ),
      };
    });
  }

  function atualizarApiUrl(url: string) {
    setProjeto((atual) => {
      const base = atual ?? fallbackProjeto;

      return {
        ...base,
        apis: base.apis.map((item, index) =>
          index === 0
            ? {
                ...item,
                url,
              }
            : item,
        ),
      };
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_26%),linear-gradient(180deg,#050816_0%,#08101f_48%,#030712_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">InfraStudio Demo</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Projeto: {projetoAtual.nome}
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            Voltar
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Plano Free
          </span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Pronto para testar
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Agente</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{agente.nome}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{agente.descricao}</p>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-200">Prompt base</span>
              <textarea
                value={agente.prompt_base}
                onChange={(event) => atualizarPromptBase(event.target.value)}
                rows={8}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </label>

            <div className="mt-6 rounded-[24px] border border-cyan-400/15 bg-cyan-400/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Área principal</p>
              <p className="mt-3 text-lg font-medium text-white">Aqui você pode testar seu agente com IA e APIs.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-slate-100">
                  Digite: quero uma camiseta preta
                </span>
                <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-slate-100">
                  Pergunte sobre produtos
                </span>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.32)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">API conectada</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{api.nome}</h2>

              <div className="mt-5 space-y-4">
                <div>
                  <span className="text-sm font-medium text-slate-200">Método</span>
                  <div className="mt-2 inline-flex rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                    {api.metodo}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-200">URL da API</span>
                  <input
                    type="text"
                    value={api.url}
                    onChange={(event) => atualizarApiUrl(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(15,23,42,0.38))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.28)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Modo demonstração</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                <li>Alterações ficam só na tela atual.</li>
                <li>Nada é salvo no banco.</li>
                <li>Nenhuma API interna do admin é chamada.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
