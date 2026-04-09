"use client";

import { useEffect, useMemo, useState } from "react";
import { Cable, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

type ConnectorConfig = {
  app_id?: string;
  client_secret?: string;
  seller_id?: string;
  nickname?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  user_id?: string;
} | null;

type Connector = {
  id?: string;
  nome: string;
  tipo: "mercado_livre";
  projetoId: string | null;
  agenteId: string | null;
  endpointBase: string;
  configuracoes: ConnectorConfig;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectMercadoSectionProps = {
  connectors: Connector[];
  createButtonClass: string;
  deletingConnectorId: string | null;
  onOpenNewConnector: () => void;
  onEditConnector: (connector: Connector) => void;
  onDeleteConnector: (connector: Connector) => void;
};

export function ProjectMercadoSection({
  connectors,
  createButtonClass,
  deletingConnectorId,
  onOpenNewConnector,
  onEditConnector,
  onDeleteConnector,
}: ProjectMercadoSectionProps) {
  const [tutorialExpanded, setTutorialExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const hasConnectors = connectors.length > 0;
  const appBaseUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }

    return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://infrastudio.vercel.app";
  }, []);
  const mercadoLivreUrls = useMemo(
    () => ({
      callback: `${appBaseUrl}/api/admin/conectores/mercado-livre/callback`,
      webhook: `${appBaseUrl}/api/mercado-livre/webhook?canal=ml`,
    }),
    [appBaseUrl],
  );

  useEffect(() => {
    if (!copiedKey) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const handleCopyUrl = async (key: string, value: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
      }
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white">
              <Cable size={18} className="text-violet-200" />
              Mercado Livre
            </h3>
            <p className="mt-1 text-sm text-slate-400">Conecte aqui a loja do Mercado Livre que este projeto vai usar.</p>
          </div>
          {!connectors.length ? (
            <button type="button" onClick={onOpenNewConnector} className={`${createButtonClass} w-auto self-start lg:self-auto`}>
              <Plus size={16} />
              Conexao
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="order-2 space-y-3 xl:order-1 xl:max-w-[920px]">
            {connectors.length ? (
              connectors.map((connector) => (
                <article
                  key={connector.id ?? connector.nome}
                  className="relative overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(255,255,255,0.025)_24%,rgba(255,255,255,0.012)_60%)] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.2),0_0_0_1px_rgba(34,211,238,0.03)] transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-180 ease-out xl:max-w-[920px]"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-base font-bold text-white">{connector.nome}</h4>
                      <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{connector.tipo}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${connector.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                        {connector.ativo ? "ativo" : "inativo"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Seller ID</p>
                        <p className="mt-2 text-sm font-semibold text-white">{connector.configuracoes?.seller_id ?? "nao informado"}</p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Nickname</p>
                        <p className="mt-2 text-sm font-semibold text-white">{connector.configuracoes?.nickname ?? "nao informado"}</p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Conta</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {connector.configuracoes?.refresh_token ? "conectada" : connector.configuracoes?.access_token ? "token manual" : "nao conectada"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 truncate text-xs text-cyan-200/80">{connector.endpointBase}</p>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {connector.id ? (
                        <a
                          href={`/api/admin/conectores/${connector.id}/mercado-livre/connect`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-all hover:border-emerald-300/30 hover:bg-emerald-500/14"
                        >
                          <ExternalLink size={14} />
                          Conectar Mercado Livre
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onEditConnector(connector)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConnector(connector)}
                        disabled={Boolean(connector.id) && deletingConnectorId === connector.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {Boolean(connector.id) && deletingConnectorId === connector.id ? "Removendo..." : "Remover completamente"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhuma loja do Mercado Livre cadastrada para este projeto ainda.</div>
            )}
          </div>

          <aside className="order-1 xl:order-2">
            <div className="rounded-2xl border border-amber-400/14 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(15,23,42,0.22))] p-5 shadow-[0_18px_36px_rgba(2,8,23,0.18)]">
              <button
                type="button"
                onClick={() => setTutorialExpanded((current) => !current)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/85">Tutorial rapido</p>
                  <h4 className="mt-2 text-lg font-bold text-white">Como conectar o Mercado Livre</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Aqui funciona em 2 etapas bem simples: primeiro voce cadastra a loja com os dados do aplicativo, depois conecta a conta do Mercado Livre para liberar o acesso.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                  {tutorialExpanded || !hasConnectors ? "Ocultar" : "Expandir"}
                </span>
              </button>

              {tutorialExpanded || !hasConnectors ? (
                <>
                  <div className="mt-4 space-y-3">
                    <a
                      href="https://developers.mercadolivre.com.br/apps"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:border-amber-300/25 hover:bg-slate-950/50"
                    >
                      Painel de apps do Mercado Livre
                      <ExternalLink size={15} />
                    </a>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Resumo rapido</p>
                    <p className="mt-3">
                      <span className="font-semibold text-white">Etapa 1. Cadastrar a loja:</span> crie um aplicativo do tipo `Web`, ative as opcoes pedidas pelo Mercado Livre e copie o `APP ID` e o `CLIENT SECRET` para este cadastro.
                    </p>
                    <p className="mt-2">
                      <span className="font-semibold text-white">Etapa 2. Conectar a loja:</span> depois de salvar, clique em conectar para autorizar a conta do Mercado Livre e finalizar a integracao.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Tutorial</p>
                      <p className="mt-2 text-sm font-semibold text-white">Links para configurar no Mercado Livre</p>
                      <p className="mt-1 text-xs text-slate-400">Abra para copiar os links que o Mercado Livre vai pedir na configuracao.</p>
                    </div>

                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      <p className="text-xs text-amber-100/90">
                        Use os links abaixo exatamente como estao. Se o campo de notificacoes nao aceitar o endereco direto, use uma URL publica intermediaria.
                      </p>

                      <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Link de retorno</p>
                        <button
                          type="button"
                          title={copiedKey === "callback" ? "URL copiada" : "Clique para copiar"}
                          onClick={() => void handleCopyUrl("callback", mercadoLivreUrls.callback)}
                          className="mt-2 inline-flex max-w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left font-mono text-[11px] text-cyan-100 transition-colors hover:border-cyan-300/25 hover:bg-cyan-500/10"
                        >
                          {mercadoLivreUrls.callback}
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Link de notificacoes</p>
                        <p className="mt-2 text-xs leading-6 text-slate-300">
                          Em alguns casos, o Mercado Livre pode nao aceitar esse endereco direto nesse campo.
                        </p>
                        <p className="mt-2 text-xs leading-6 text-slate-300">
                          Se isso acontecer, use uma URL publica intermediaria e aponte essa URL para o endereco abaixo:
                        </p>
                        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-cyan-100">
                          {mercadoLivreUrls.webhook}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-500/18 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50/90">
                    Depois de salvar, o proximo passo e clicar em `Editar` para revisar os dados e concluir a conexao da conta.
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
