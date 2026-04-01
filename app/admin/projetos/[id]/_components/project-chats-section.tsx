"use client";

import { Bot, Cable, Expand, ExternalLink, MessageSquareText, PanelsTopLeft, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

type ChatWidget = {
  id?: string;
  nome: string;
  slug: string;
  projetoId: string | null;
  agenteId: string | null;
  dominio: string;
  whatsappCelular: string;
  tema: "dark" | "light";
  corPrimaria: string;
  fundoTransparente: boolean;
  ativo: boolean;
};

type WidgetAgentSummary = {
  id: string;
  nome: string;
} | null;

type ProjectChatsSectionProps = {
  widgets: ChatWidget[];
  deletingWidgetId: string | null;
  createButtonClass: string;
  onOpenNewWidget: () => void;
  onResolveWidgetAgent: (widget: ChatWidget) => WidgetAgentSummary;
  onOpenWidgetCode: (widget: ChatWidget) => void;
  onEditWidget: (widget: ChatWidget) => void;
  onDeleteWidget: (widget: ChatWidget) => void;
};

export function ProjectChatsSection({
  widgets,
  deletingWidgetId,
  createButtonClass,
  onOpenNewWidget,
  onResolveWidgetAgent,
  onOpenWidgetCode,
  onEditWidget,
  onDeleteWidget,
}: ProjectChatsSectionProps) {
  return (
    <div className="grid gap-6">
      <section>
        <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><MessageSquareText size={18} className="text-rose-200" />Chats do projeto</h3>
            <p className="mt-1 text-sm text-slate-400">Widgets criados para este projeto e os codigos prontos para instalar no site.</p>
          </div>
          <button
            type="button"
            onClick={onOpenNewWidget}
            className={createButtonClass}
          >
            <Plus size={16} />
            Criar widget do site
          </button>
        </div>

        <div className="space-y-4 p-2 pt-4">
          <div className="rounded-2xl border border-amber-400/14 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(15,23,42,0.18))] px-4 py-4 shadow-[0_18px_36px_rgba(2,8,23,0.16)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/85">Documentacao</p>
                <p className="mt-2 text-sm text-slate-200">Referencia unica para todos os widgets quando o site precisar controlar criacao, atualizacao e destruicao do chat.</p>
              </div>
              <a
                href="/docs/chat-widget-host-control"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-white/5 px-4 py-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ExternalLink size={15} />
                Abrir documentacao completa
              </a>
            </div>
          </div>

          {widgets.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {widgets.map((widget) => {
                const agente = onResolveWidgetAgent(widget);

                return (
                  <article key={`chat-widget-card-${widget.id ?? widget.slug}`} className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),rgba(255,255,255,0.03)_24%,rgba(255,255,255,0.012)_60%)] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.24),0_0_0_1px_rgba(34,211,238,0.04)] transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-180 ease-out">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute right-4 top-4 ${widget.ativo ? "text-cyan-300/40 animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.3)]" : "text-slate-500/28"}`}
                    >
                      <PanelsTopLeft size={34} strokeWidth={1.6} />
                    </div>

                    <div className="relative flex items-start justify-between gap-3 pr-12">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-base font-bold text-white">{widget.nome}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${widget.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {widget.ativo ? "ativo" : "inativo"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
                          {widget.dominio || "Widget pronto para instalar no site deste projeto."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Trecho do widget</p>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-200">
                        {agente?.nome ? `Conectado ao agente ${agente.nome}.` : "Sem agente especifico; usa o agente principal do projeto."} Tema {widget.tema} com cor {widget.corPrimaria} e slug {widget.slug}.
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { key: "agente", label: "Agente", value: agente?.nome ?? "Projeto", active: Boolean(agente), activeClass: "text-cyan-100", inactiveClass: "text-slate-500", icon: Bot },
                        { key: "dominio", label: "Dominio", value: widget.dominio || "Livre", active: Boolean(widget.dominio), activeClass: "text-emerald-100", inactiveClass: "text-slate-500", icon: Cable },
                        { key: "tema", label: "Tema", value: widget.tema, active: true, activeClass: "text-amber-100", inactiveClass: "text-slate-500", icon: Sparkles },
                        { key: "slug", label: "Slug", value: widget.slug, active: true, activeClass: "text-violet-100", inactiveClass: "text-slate-500", icon: MessageSquareText },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <span
                            key={`${widget.slug}-${item.key}`}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${item.active ? item.activeClass : item.inactiveClass}`}
                          >
                            <Icon size={13} />
                            {item.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.active ? "bg-black/15 text-current" : "bg-white/5 text-slate-400"}`}>
                              {item.value}
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => onOpenWidgetCode(widget)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14"
                          >
                            <Expand size={14} />
                            Ver codigo
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditWidget(widget)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWidget(widget)}
                            disabled={Boolean(widget.id) && deletingWidgetId === widget.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {Boolean(widget.id) && deletingWidgetId === widget.id ? "Removendo..." : "Remover"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
              Nenhum widget de chat criado ainda. Crie um widget para exibir aqui os cards com os codigos de integracao.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
