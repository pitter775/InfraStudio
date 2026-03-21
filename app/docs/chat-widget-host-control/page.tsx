const lifecycleEvents = ["mounted", "context_updated", "hidden", "destroyed", "blocked_by_route", "blocked_by_policy"];

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
    description: "Cria o widget do zero. Se ja existir uma instancia montada, a ideia do host e destruir antes e montar de novo com o novo contexto.",
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
    example: "'https://infrastudio.vercel.app'",
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
];

const minimalExample = [
  "window.InfraChat.mount({",
  "  projeto: 'infrastudio',",
  "  agente: 'agente-comercial-principal',",
  "  apiBase: 'https://infrastudio.vercel.app',",
  "  strictHostControl: true,",
  "});",
].join("\n");

const practicalExample = [
  "<script src=\"https://infrastudio.vercel.app/chat.js\" data-projeto=\"infrastudio\" data-agente=\"agente-comercial-principal\"></script>",
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
  "      apiBase: 'https://infrastudio.vercel.app',",
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

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

export default function ChatWidgetHostControlDocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">InfraStudio Docs</p>
        <h1 className="mt-4 text-4xl font-extrabold text-white">Widget de chat em modo host-controlled</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">
          Esta documentacao define o contrato recomendado para integrar o widget white-label da InfraStudio em qualquer aplicacao hospedeira. A ideia central e
          simples: o chat so existe quando o host permitir. Fora desse contexto, ele deve ser completamente destruido.
        </p>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold text-white">Princípios de integracao</h2>
            <div className="mt-5 space-y-3">
              {integrationPrinciples.map((item, index) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Principio {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">API global</h2>
              <div className="mt-4 space-y-4">
                {apiReference.map((item) => (
                  <div key={item.name} className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                    <p className="text-sm font-bold text-white">
                      <code>{item.name}</code>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">Logs de ciclo de vida</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Esses eventos ajudam a diagnosticar por que o widget montou, atualizou, ocultou, destruiu ou foi bloqueado.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lifecycleEvents.map((item) => (
                  <span key={item} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-white">O que e obrigatorio e o que e opcional</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            Abaixo esta o contrato mais importante para o `mount`. Nem todo campo do contexto precisa existir sempre. O host deve mandar o que ele realmente sabe,
            sem inventar identificadores.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[170px_180px_minmax(0,1fr)] bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <div>Campo</div>
              <div>Status</div>
              <div>Descricao</div>
            </div>
            {configTable.map((row) => (
              <div key={row.field} className="grid grid-cols-[170px_180px_minmax(0,1fr)] border-t border-white/8 bg-white/[0.03] px-4 py-4 text-sm">
                <div className="font-semibold text-white">
                  <code>{row.field}</code>
                  <p className="mt-2 text-xs text-cyan-200">{row.example}</p>
                </div>
                <div className="pr-4 text-slate-300">{row.required}</div>
                <div className="leading-6 text-slate-300">{row.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-[#07111f] p-6">
          <h2 className="text-2xl font-bold text-white">Exemplo mínimo válido</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Este e o menor exemplo que ainda respeita o modelo host-controlled. Ele cria o widget, mas nao traz contexto rico.
          </p>
          <div className="mt-5">
            <CodeBlock code={minimalExample} />
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-[#07111f] p-6">
          <h2 className="text-2xl font-bold text-white">Exemplo prático recomendado</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Este exemplo cobre rota autorizada, unlock, tenant, usuario, recurso, personalizacao visual e destruicao fora do contexto permitido.
          </p>
          <div className="mt-5">
            <CodeBlock code={practicalExample} />
          </div>

          <h3 className="mt-8 text-lg font-bold text-white">Atualizando o contexto sem recarregar o script</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use isso quando a tela continua autorizada, mas o recurso ou o usuario mudou.
          </p>
          <div className="mt-4">
            <CodeBlock code={updateExample} />
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-white">O que significa cada campo</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            O host pode adaptar os nomes internos do seu dominio, mas a semantica recomendada e esta: informar quem e o tenant, quem e o usuario, qual e o
            recurso da tela, em qual rota esta e qual politica permite a existencia do chat.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
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
              `resource` nao significa necessariamente "imovel". Ele significa "o recurso principal da pagina atual". Se o cliente for imobiliaria, costuma ser
              um imovel. Se for e-commerce, pode ser um produto. Se for oficina, pode ser um veiculo. Se for SaaS, pode ser uma assinatura, ticket ou projeto.
            </p>
            <p className="mt-2">
              O mais importante e que, ao trocar esse recurso, o host atualize ou destrua o chat. Esse e um dos pontos mais sensiveis para evitar vazamento de
              contexto entre uma tela e outra.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
            <p className="font-semibold text-white">Sobre `user.id`</p>
            <p className="mt-2">
              `user.id` nao e obrigatorio. Se o host conhece a identidade da pessoa, ele deve enviar. Se ainda nao conhece, pode omitir `user` inteiro ou mandar
              apenas dados parciais, como `tipo`, `origem` ou `segmento`.
            </p>
            <p className="mt-2">Nao invente IDs apenas para preencher o campo. Use somente identificadores reais e confiaveis do sistema hospedeiro.</p>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-white">Quando usar `updateContext` e quando destruir</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-slate-950/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <div>Situacao</div>
              <div>Acao recomendada</div>
            </div>
            {lifecycleActions.map((row) => (
              <div key={row.situation} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t border-white/8 bg-white/[0.03] px-4 py-4 text-sm">
                <div className="pr-4 leading-6 text-white">{row.situation}</div>
                <div className="leading-6 text-slate-300">{row.action}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold text-white">Exemplos por dominio</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            O formato do contexto e sempre o mesmo, mas o significado de `resource` muda de acordo com o negocio do cliente.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
        </section>
      </div>
    </main>
  );
}
