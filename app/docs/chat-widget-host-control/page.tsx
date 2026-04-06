import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Documentacao do Chat Widget Host-Controlled",
  description:
    "Guia tecnico para integrar o chat widget da InfraStudio com controle de host, isolamento de contexto e regras claras de ciclo de vida.",
  path: "/docs/chat-widget-host-control",
});

const lifecycleEvents = ["mounted", "context_updated", "hidden", "shown", "destroyed", "blocked_by_route", "blocked_by_policy"];

const integrationPrinciples = [
  "O host decide quando o chat pode existir. O widget nao assume autonomia.",
  "Ao sair do contexto autorizado, o host deve chamar `destroy()` imediatamente.",
  "Ao trocar tenant, usuario, agente, recurso ou rota, o host deve invalidar o contexto anterior.",
  "O SDK pode ser carregado uma vez, mas a montagem do chat so acontece por comando explicito.",
  "O objetivo e evitar vazamento de contexto, UI e sessao entre clientes, paginas e recursos.",
];

const apiReference = [
  {
    name: "window.InfraChat.mount(config)",
    description: "Monta o widget. Se ja existir uma instancia do mesmo projeto/agente, o SDK reaproveita a sessao, atualiza contexto/UI e pode reexibir um chat oculto.",
  },
  {
    name: "window.InfraChat.updateContext(context)",
    description: "Atualiza o contexto atual sem recarregar o script. Use quando a tela continua autorizada, mas o escopo mudou.",
  },
  {
    name: "window.InfraChat.hide()",
    description: "Oculta visualmente o widget sem destruir a instancia. Use apenas quando fizer sentido manter a mesma sessao ainda autorizada.",
  },
  {
    name: "window.InfraChat.show({ open? })",
    description: "Reexibe uma instancia previamente ocultada. Pode opcionalmente abrir o painel na volta com `open: true`.",
  },
  {
    name: "window.InfraChat.destroy()",
    description: "Desmonta completamente a instancia atual. Remove root, listeners, timers, controllers e estado em memoria.",
  },
  {
    name: "window.InfraChat.isMounted()",
    description: "Informa se existe uma instancia ativa do widget naquele momento.",
  },
  {
    name: "window.InfraChat.getState()",
    description: "Retorna um snapshot de debug com dados de montagem, loading, contexto e logs de ciclo de vida.",
  },
];

const configTable = [
  {
    field: "projeto",
    required: "Obrigatorio",
    description: "Slug ou identificador do projeto na InfraStudio. Sem ele o mount nao consegue resolver o contexto base.",
    example: "'infrastudio'",
  },
  {
    field: "agente",
    required: "Obrigatorio",
    description: "Slug ou identificador do agente que deve atender esse canal.",
    example: "'agente-comercial-principal'",
  },
  {
    field: "apiBase",
    required: "Obrigatorio na pratica",
    description: "URL base onde o SDK vai chamar `/api/chat` e `/api/chat/config`. Se omitido, ele tenta usar o `src` do script como default.",
    example: "'https://infrastudio.pro'",
  },
  {
    field: "strictHostControl",
    required: "Recomendado",
    description: "Mantem o widget em modo estritamente controlado pelo host. Para este modelo, o valor esperado e `true`.",
    example: "true",
  },
  {
    field: "context",
    required: "Recomendado",
    description: "Bloco de contexto de negocio e de tela. Quanto melhor o host informar esse contexto, melhor o isolamento e a personalizacao.",
    example: "{ tenant, user, resource, route, ui }",
  },
  {
    field: "policy",
    required: "Recomendado",
    description: "Regra de exibicao enviada pelo host. Serve para travar o chat a rotas ou cenarios permitidos.",
    example: "{ allowed: true, allowedRoutes: ['/imoveis/*'] }",
  },
  {
    field: "open",
    required: "Opcional",
    description: "Se `true`, o widget ja monta aberto.",
    example: "false",
  },
  {
    field: "hidden",
    required: "Opcional",
    description: "Se `true`, monta oculto visualmente. Em geral, prefira decidir isso no host antes de montar.",
    example: "false",
  },
];

const contextFields = [
  {
    name: "tenant",
    required: "Opcional, mas recomendado em multicliente",
    example: "{ id: 'cliente-a', nome: 'Cliente A' }",
    description: "Identifica qual cliente, marca, operacao ou tenant e dono daquele contexto. Esse campo e importante quando a mesma InfraStudio atende mais de um cliente.",
    notes: [
      "Use quando o mesmo host ou a mesma conta pode operar mais de um cliente.",
      "Ajuda a evitar vazamento de sessao entre tenants.",
      "Se o seu produto e single-tenant, voce pode omitir.",
    ],
  },
  {
    name: "user",
    required: "Opcional",
    example: "{ id: 'user-42', tipo: 'lead' }",
    description: "Representa a pessoa que esta usando ou vendo o chat naquela sessao.",
    notes: [
      "`user.id` nao e obrigatorio.",
      "Se o host nao conhece a pessoa ainda, pode omitir `user` ou mandar so dados parciais, como `{ tipo: 'lead' }`.",
      "Nao invente IDs. Use apenas identificadores confiaveis do host.",
    ],
  },
  {
    name: "resource",
    required: "Fortemente recomendado quando a pagina gira em torno de um item",
    example: "{ id: 'imovel-99', tipo: 'imovel' }",
    description: "Representa o objeto principal da pagina atual. Ele nao significa necessariamente imovel; significa o recurso de negocio atualmente aberto.",
    notes: [
      "Num portal imobiliario, costuma ser o imovel atual.",
      "Num e-commerce, pode ser o produto.",
      "Numa oficina, pode ser o veiculo.",
      "Num SaaS, pode ser um ticket, projeto, assinatura ou conta.",
    ],
  },
  {
    name: "route",
    required: "Recomendado",
    example: "{ path: window.location.pathname }",
    description: "Informa em qual rota ou pagina o host esta. E a base mais comum para politica de exibicao e destruicao do widget.",
    notes: [
      "O mais comum e mandar pelo menos `path`.",
      "Se quiser, voce pode incluir metadados extras, como `name`, `section` ou `template`.",
      "Esse campo ajuda o host a demonstrar explicitamente que o contexto de tela mudou.",
    ],
  },
  {
    name: "ui",
    required: "Opcional",
    example: "{ title: 'Atendimento premium', theme: 'dark', accent: '#2563eb' }",
    description: "Personaliza a identidade visual daquele contexto atual.",
    notes: [
      "Pode variar por cliente, agente, campanha, imovel ou rota.",
      "Use para refletir branding, titulo do atendimento e cor principal.",
      "Nao substitui o isolamento de contexto; e apenas a camada visual.",
    ],
  },
  {
    name: "policy",
    required: "Recomendado",
    example: "{ allowed: true, allowedRoutes: ['/imoveis/*'] }",
    description: "Define a permissao de existencia do chat naquele momento.",
    notes: [
      "Se `allowed` for `false`, o widget deve ser bloqueado.",
      "Se `allowedRoutes` existir e a rota nao bater, o widget deve ser bloqueado.",
      "Quando bloqueado, o lifecycle log esperado e `blocked_by_policy` ou `blocked_by_route`.",
    ],
  },
];

const lifecycleActions = [
  {
    situation: "Entrou numa pagina autorizada pela politica do host",
    action: "Chamar `mount(...)` com o contexto atual.",
  },
  {
    situation: "Mudou o recurso, mas continua dentro de uma pagina ainda autorizada",
    action: "Atualizar com `updateContext(...)` ou, se quiser isolamento maximo, `destroy()` seguido de `mount(...)` limpo.",
  },
  {
    situation: "Mudou de tenant, agente ou perfil de usuario",
    action: "Preferir `destroy()` e `mount(...)` de novo para evitar heranca indevida.",
  },
  {
    situation: "Saiu da pagina autorizada",
    action: "Chamar `destroy()` imediatamente.",
  },
  {
    situation: "Quer apenas ocultar temporariamente o mesmo chat ainda autorizado",
    action: "Usar `hide()`.",
  },
  {
    situation: "O chat foi ocultado e precisa voltar sem perder a sessao",
    action: "Usar `show({ open: true })` ou chamar `mount(...)` novamente com o mesmo projeto/agente.",
  },
];

const minimalExample = [
  "window.InfraChat.mount({",
  "  projeto: 'infrastudio',",
  "  agente: 'agente-comercial-principal',",
  "  apiBase: 'https://infrastudio.pro',",
  "  strictHostControl: true,",
  "});",
].join("\n");

const practicalExample = [
  "<script src=\"https://infrastudio.pro/chat.js\" data-projeto=\"infrastudio\" data-agente=\"agente-comercial-principal\"></script>",
  "<script>",
  "  const isAllowedRoute = window.location.pathname.startsWith('/imoveis/');",
  "  const hasUnlockedChat = window.__unlockChat === true;",
  "",
  "  if (!isAllowedRoute || !hasUnlockedChat) {",
  "    window.InfraChat.destroy();",
  "  } else {",
  "    window.InfraChat.mount({",
  "      projeto: 'infrastudio',",
  "      agente: 'agente-comercial-principal',",
  "      apiBase: 'https://infrastudio.pro',",
  "      strictHostControl: true,",
  "      context: {",
  "        tenant: { id: 'cliente-a', nome: 'Cliente A' },",
  "        user: { id: 'lead-42', tipo: 'lead' },",
  "        resource: { id: 'imovel-99', tipo: 'imovel' },",
  "        route: { path: window.location.pathname },",
  "        ui: {",
  "          title: 'Especialista em imoveis',",
  "          theme: 'dark',",
  "          accent: '#2563eb',",
  "          transparent: true,",
  "        },",
  "      },",
  "      policy: {",
  "        allowed: true,",
  "        allowedRoutes: ['/imoveis/*'],",
  "      },",
  "    });",
  "  }",
  "</script>",
].join("\n");

const updateExample = [
  "window.InfraChat.updateContext({",
  "  user: { id: 'lead-84', tipo: 'lead' },",
  "  resource: { id: 'imovel-123', tipo: 'imovel' },",
  "  route: { path: window.location.pathname },",
  "});",
].join("\n");

const showExample = [
  "window.InfraChat.hide();",
  "",
  "// Mais tarde, para voltar a exibir o mesmo chat",
  "window.InfraChat.show({ open: true });",
].join("\n");

const realEstateExample = [
  "context: {",
  "  tenant: { id: 'imobiliaria-sol' },",
  "  user: { id: 'lead-42', tipo: 'lead' },",
  "  resource: { id: 'imovel-99', tipo: 'imovel' },",
  "  route: { path: '/imoveis/apartamento-centro' },",
  "}",
].join("\n");

const commerceExample = [
  "context: {",
  "  tenant: { id: 'loja-x' },",
  "  user: { id: 'cliente-77', tipo: 'comprador' },",
  "  resource: { id: 'sku-123', tipo: 'produto' },",
  "  route: { path: '/produtos/camiseta-premium' },",
  "}",
].join("\n");

const serviceExample = [
  "context: {",
  "  tenant: { id: 'oficina-y' },",
  "  user: { id: 'cliente-19', tipo: 'condutor' },",
  "  resource: { id: 'placa-abc1d23', tipo: 'veiculo' },",
  "  route: { path: '/servicos/freio' },",
  "}",
].join("\n");

const docSections = [
  { id: "overview", label: "Visao geral" },
  { id: "principles", label: "Principios" },
  { id: "api", label: "API global" },
  { id: "logs", label: "Lifecycle" },
  { id: "config", label: "Configuracao" },
  { id: "examples", label: "Exemplos" },
  { id: "context", label: "Contexto" },
  { id: "lifecycle-actions", label: "Fluxo recomendado" },
  { id: "domains", label: "Dominios" },
];

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-[28px] border border-white/10 bg-white/[0.045] p-6 md:p-8 ${className}`}>
      {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl font-bold text-white md:text-[2rem]">{title}</h2>
      {description ? <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400 md:text-[15px]">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ChatWidgetHostControlDocsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#020617_0%,#07111f_42%,#020617_100%)] px-4 py-10 text-slate-100 md:px-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_-34px_rgba(8,15,30,0.92)] backdrop-blur-xl md:p-8">
          <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="p-5">
                <a href="/" className="group block p-4 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden">
                      <img src="/logo.png" alt="InfraStudio" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-white">InfraStudio</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Smart Systems Lab</p>
                    </div>
                  </div>
                </a>

                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300">InfraStudio Docs</p>
                <h1 className="mt-3 text-2xl font-bold text-white">Host-controlled chat widget</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Navegacao rapida para uma documentacao longa, no estilo de docs de produto.
                </p>

                <nav className="mt-6 space-y-1">
                  {docSections.map((section, index) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-cyan-200 group-hover:border-cyan-400/30 group-hover:bg-cyan-500/10">
                        {index + 1}
                      </span>
                      <span>{section.label}</span>
                    </a>
                  ))}
                </nav>

                <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Contrato central</p>
                  <p className="mt-2 text-sm leading-6 text-cyan-50">
                    O chat so deve existir quando o host permitir. Fora do contexto autorizado, a acao esperada e `destroy()`.
                  </p>
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-8">
              <Section
                id="overview"
                eyebrow="Visao geral"
                title="Widget de chat em modo host-controlled"
                description="Esta documentacao define o contrato recomendado para integrar o widget white-label da InfraStudio em qualquer aplicacao hospedeira. A ideia central e simples: o chat so existe quando o host permitir. Fora desse contexto, ele deve ser completamente destruido."
                className="bg-[linear-gradient(180deg,rgba(8,15,30,0.86),rgba(6,10,24,0.74))]"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Montagem</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">O host decide quando chamar `mount(...)`.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Contexto</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Tenant, usuario, recurso e rota devem refletir o momento atual.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Isolamento</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Ao sair do contexto autorizado, destrua o widget imediatamente.</p>
                  </div>
                </div>
              </Section>

              <Section id="principles" eyebrow="Base" title="Principios de integracao">
                <div className="grid gap-4 md:grid-cols-2">
                  {integrationPrinciples.map((item, index) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Principio {index + 1}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="api" eyebrow="Referencia" title="API global">
                <div className="space-y-4">
                  {apiReference.map((item) => (
                    <div key={item.name} className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
                      <p className="text-sm font-bold text-white">
                        <code>{item.name}</code>
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                id="logs"
                eyebrow="Observabilidade"
                title="Logs de ciclo de vida"
                description="Esses eventos ajudam a diagnosticar por que o widget montou, atualizou, ocultou, destruiu ou foi bloqueado."
              >
                <div className="flex flex-wrap gap-2">
                  {lifecycleEvents.map((item) => (
                    <span key={item} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                      {item}
                    </span>
                  ))}
                </div>
              </Section>

              <Section
                id="config"
                eyebrow="Contrato"
                title="O que e obrigatorio e o que e opcional"
                description="Abaixo esta o contrato mais importante para o `mount`. Nem todo campo do contexto precisa existir sempre. O host deve mandar o que ele realmente sabe, sem inventar identificadores."
              >
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[170px_180px_minmax(0,1fr)] bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:grid">
                    <div>Campo</div>
                    <div>Status</div>
                    <div>Descricao</div>
                  </div>
                  {configTable.map((row) => (
                    <div key={row.field} className="border-t border-white/8 bg-white/[0.03] px-4 py-4 text-sm md:grid md:grid-cols-[170px_180px_minmax(0,1fr)] md:gap-0">
                      <div className="font-semibold text-white">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:hidden">Campo</p>
                        <code>{row.field}</code>
                        <p className="mt-2 text-xs text-cyan-200">{row.example}</p>
                      </div>
                      <div className="mt-4 pr-4 text-slate-300 md:mt-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:hidden">Status</p>
                        {row.required}
                      </div>
                      <div className="mt-4 leading-6 text-slate-300 md:mt-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:hidden">Descricao</p>
                        {row.description}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                id="examples"
                eyebrow="Implementacao"
                title="Exemplos principais"
                description="Comece pelo minimo valido e avance para o exemplo completo quando quiser contexto, branding e regras de exibicao."
                className="bg-[linear-gradient(180deg,rgba(8,17,31,0.94),rgba(6,12,24,0.84))]"
              >
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-white">Exemplo minimo valido</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Este e o menor exemplo que ainda respeita o modelo host-controlled. Ele cria o widget, mas nao traz contexto rico.
                    </p>
                    <div className="mt-4">
                      <CodeBlock code={minimalExample} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">Exemplo pratico recomendado</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Este exemplo cobre rota autorizada, unlock, tenant, usuario, recurso, personalizacao visual e destruicao fora do contexto permitido.
                    </p>
                    <div className="mt-4">
                      <CodeBlock code={practicalExample} />
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">Atualizando o contexto</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">Use isso quando a tela continua autorizada, mas o recurso ou o usuario mudou.</p>
                      <div className="mt-4">
                        <CodeBlock code={updateExample} />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">Ocultando e exibindo novamente</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        `hide()` some com o widget, mas preserva a sessao em memoria. Para voltar, use `show()` ou monte outra vez com o mesmo projeto e agente.
                      </p>
                      <div className="mt-4">
                        <CodeBlock code={showExample} />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                id="context"
                eyebrow="Semantica"
                title="O que significa cada campo"
                description="O host pode adaptar os nomes internos do seu dominio, mas a semantica recomendada e esta: informar quem e o tenant, quem e o usuario, qual e o recurso da tela, em qual rota esta e qual politica permite a existencia do chat."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {contextFields.map((field) => (
                    <div key={field.name} className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white">
                          <code>{field.name}</code>
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">{field.required}</span>
                      </div>
                      <code className="mt-3 block rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] leading-5 text-cyan-100">
                        {field.example}
                      </code>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{field.description}</p>
                      <div className="mt-3 space-y-2">
                        {field.notes.map((note) => (
                          <p key={note} className="text-xs leading-5 text-slate-400">
                            {note}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
                  <p className="font-semibold text-white">Sobre `resource`</p>
                  <p className="mt-2">
                    `resource` nao significa necessariamente "imovel". Ele significa "o recurso principal da pagina atual". Se o cliente for imobiliaria, costuma ser um imovel. Se for e-commerce, pode ser um produto. Se for oficina, pode ser um veiculo. Se for SaaS, pode ser uma assinatura, ticket ou projeto.
                  </p>
                  <p className="mt-2">
                    O mais importante e que, ao trocar esse recurso, o host atualize ou destrua o chat. Esse e um dos pontos mais sensiveis para evitar vazamento de contexto entre uma tela e outra.
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
                  <p className="font-semibold text-white">Sobre `user.id`</p>
                  <p className="mt-2">
                    `user.id` nao e obrigatorio. Se o host conhece a identidade da pessoa, ele deve enviar. Se ainda nao conhece, pode omitir `user` inteiro ou mandar apenas dados parciais, como `tipo`, `origem` ou `segmento`.
                  </p>
                  <p className="mt-2">Nao invente IDs apenas para preencher o campo. Use somente identificadores reais e confiaveis do sistema hospedeiro.</p>
                </div>
              </Section>

              <Section id="lifecycle-actions" eyebrow="Operacao" title="Quando usar `updateContext` e quando destruir">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:grid">
                    <div>Situacao</div>
                    <div>Acao recomendada</div>
                  </div>
                  {lifecycleActions.map((row) => (
                    <div key={row.situation} className="border-t border-white/8 bg-white/[0.03] px-4 py-4 text-sm md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="pr-4 leading-6 text-white">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:hidden">Situacao</p>
                        {row.situation}
                      </div>
                      <div className="mt-3 leading-6 text-slate-300 md:mt-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 md:hidden">Acao</p>
                        {row.action}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                id="domains"
                eyebrow="Adaptacao"
                title="Exemplos por dominio"
                description="O formato do contexto e sempre o mesmo, mas o significado de `resource` muda de acordo com o negocio do cliente."
              >
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                    <h3 className="text-lg font-bold text-white">Imobiliaria</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">O recurso principal costuma ser o imovel.</p>
                    <div className="mt-4">
                      <CodeBlock code={realEstateExample} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                    <h3 className="text-lg font-bold text-white">E-commerce</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">O recurso principal costuma ser o produto em exibicao.</p>
                    <div className="mt-4">
                      <CodeBlock code={commerceExample} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                    <h3 className="text-lg font-bold text-white">Servico</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">O recurso principal pode ser um veiculo, atendimento ou ordem de servico.</p>
                    <div className="mt-4">
                      <CodeBlock code={serviceExample} />
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
