"use client";

import { useState } from "react";
import { Activity, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

type ApiCampo = {
  id?: string;
  nome: string;
  tipo: "string" | "number" | "boolean";
  descricao: string;
};

type ApiParametro = {
  nome: string;
  tipo: "string" | "number" | "boolean";
  obrigatorio: boolean;
};

type Api = {
  id: string;
  projetoId: string | null;
  nome: string;
  url: string;
  metodo: "GET";
  descricao: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  campos: ApiCampo[];
  parametros: ApiParametro[];
};

type ProjectApisSectionProps = {
  apis: Api[];
  createButtonClass: string;
  editButtonClass: string;
  dangerButtonClass: string;
  onOpenNewApi: () => void;
  onEditApi: (api: Api) => void;
  onDeleteApi: (api: Api) => void;
};

function summarizeApiFields(campos: ApiCampo[], limit = 6) {
  const labels = campos.slice(0, limit).map((campo) => campo.nome);
  if (campos.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} +${campos.length - limit}`;
}

export function ProjectApisSection({
  apis,
  createButtonClass,
  editButtonClass,
  dangerButtonClass,
  onOpenNewApi,
  onEditApi,
  onDeleteApi,
}: ProjectApisSectionProps) {
  const [tutorialExpanded, setTutorialExpanded] = useState(false);
  const hasApis = apis.length > 0;

  return (
    <section>
      <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-100/88">
            <Activity size={18} className="text-sky-200" />
            APIs do projeto
          </h3>
          <p className="mt-1 text-sm text-slate-400">Gerencie as APIs externas, teste o retorno e controle os campos ativos.</p>
        </div>
        <button type="button" onClick={onOpenNewApi} className={createButtonClass}>
          <Plus size={16} />
          Nova API
        </button>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="order-2 space-y-3 pt-2 xl:order-1 xl:max-w-[920px]">
          {apis.length ? (
            apis.map((api) => (
              <div key={api.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4 transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-180 ease-out">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-base font-medium text-slate-100/88">{api.nome}</h4>
                      <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{api.metodo}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${api.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                        {api.ativo ? "ativa" : "inativa"}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-slate-400">{api.url}</p>
                    <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-slate-400">{api.descricao || "Sem descricao."}</p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Campos</span>
                        <span className="mt-1 block font-semibold text-white">{api.campos.length}</span>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Parametros</span>
                        <span className="mt-1 block font-semibold text-white">{api.parametros.length}</span>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 sm:col-span-2">
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Resumo</span>
                        <span className="mt-1 block text-cyan-200/80">
                          {api.campos.length ? summarizeApiFields(api.campos) : "Nenhum campo detectado"}
                        </span>
                      </div>
                    </div>
                    {api.parametros.length ? (
                      <p className="mt-2 text-xs text-amber-200/80">
                        Parametros: {api.parametros.map((parametro) => `${parametro.nome}${parametro.obrigatorio ? "*" : ""}`).join(", ")}
                      </p>
                    ) : null}
                    {api.parametros.some((parametro) => parametro.obrigatorio) ? (
                      <p className="mt-1 text-xs text-cyan-100/80">
                        Essa API so funciona no chat quando o contexto enviar:{" "}
                        {api.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                    <button type="button" onClick={() => onEditApi(api)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${editButtonClass}`}>
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button type="button" onClick={() => onDeleteApi(api)} className={dangerButtonClass}>
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhuma API cadastrada para este projeto ainda.</div>
          )}
        </div>

        <aside className="order-1 xl:order-2">
          <div className="rounded-2xl border border-sky-400/14 bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(15,23,42,0.22))] p-5 shadow-[0_18px_36px_rgba(2,8,23,0.18)]">
            <button
              type="button"
              onClick={() => setTutorialExpanded((current) => !current)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100/85">Tutorial rapido</p>
                <h4 className="mt-2 text-lg font-bold text-white">Como cadastrar uma API</h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Aqui o fluxo ideal e simples: cadastre uma URL GET real, rode o teste para descobrir os campos e marque apenas o que o agente deve usar.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                {tutorialExpanded || !hasApis ? "Ocultar" : "Expandir"}
              </span>
            </button>

            {tutorialExpanded || !hasApis ? (
              <>
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Resumo rapido</p>
                  <p className="mt-3">
                    <span className="font-semibold text-white">Etapa 1. Cadastre a URL:</span> informe um endpoint GET publico ou acessivel pelo backend, com a URL mais proxima do caso real.
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-white">Etapa 2. Rode o teste:</span> o botao de teste chama a API, inspeciona a resposta e sugere os campos simples e aninhados.
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-white">Etapa 3. Enxugue o retorno:</span> deixe ativos so os campos que o agente realmente precisa para responder.
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Boas praticas</p>
                  <div className="mt-3 space-y-2 text-sm leading-6">
                    <p>Use placeholders na URL como <code className="rounded bg-slate-950/50 px-1.5 py-0.5 text-xs text-sky-100">{"{id}"}</code> ou <code className="rounded bg-slate-950/50 px-1.5 py-0.5 text-xs text-sky-100">{"{cpf}"}</code> quando a rota depender de contexto.</p>
                    <p>Preencha os valores de teste antes de testar, para o sistema montar uma chamada valida e detectar os campos certos.</p>
                    <p>Evite expor respostas gigantes. Quanto menor e mais focado o payload, melhor fica o uso pelo agente.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Exemplo rapido</p>
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 font-mono text-[11px] text-sky-100">
                    https://api.exemplo.com/imoveis/{"{id}"}
                  </div>
                  <p className="mt-3 text-xs leading-6 text-slate-400">
                    Depois do teste, marque os campos uteis como `titulo`, `preco`, `bairro`, `status` e ignore o resto.
                  </p>
                </div>

                <a
                  href="https://httpbin.org/get"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:border-sky-300/25 hover:bg-slate-950/50"
                >
                  Exemplo publico simples para testes
                  <ExternalLink size={15} />
                </a>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
