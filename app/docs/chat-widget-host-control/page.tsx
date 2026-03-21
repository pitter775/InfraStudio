const steps = [
  "Carregue `chat.js`, mas nao deixe o script montar o chat sozinho.",
  "Use `window.InfraChat.mount(config)` apenas quando a rota e a politica do host permitirem.",
  "Passe contexto isolado por cliente, usuario, agente, recurso e rota atual.",
  "Ao mudar de tenant, agente, imovel, usuario ou pagina, envie `updateContext(...)` com o novo escopo.",
  "Ao sair do contexto permitido, chame `destroy()` para desmontar tudo imediatamente.",
];

const lifecycleEvents = ["mounted", "context_updated", "hidden", "destroyed", "blocked_by_route", "blocked_by_policy"];

const example = [
  "<script src=\"https://seu-dominio/chat.js\" data-projeto=\"cliente-a\" data-agente=\"corretor-principal\"></script>",
  "<script>",
  "  const canMount = window.location.pathname.startsWith('/imoveis/') && window.__unlockChat === true;",
  "",
  "  if (canMount) {",
  "    window.InfraChat.mount({",
  "      projeto: 'cliente-a',",
  "      agente: 'corretor-principal',",
  "      apiBase: 'https://seu-dominio',",
  "      strictHostControl: true,",
  "      context: {",
  "        route: { path: window.location.pathname },",
  "        client: { id: 'cliente-a', role: 'premium' },",
  "        user: { id: 'user-42', type: 'lead' },",
  "        resource: { id: 'imovel-99', kind: 'imovel' },",
  "      },",
  "      policy: {",
  "        allowed: true,",
  "        allowedRoutes: ['/imoveis/*'],",
  "      },",
  "    });",
  "  } else {",
  "    window.InfraChat.destroy();",
  "  }",
  "</script>",
].join("\n");

export default function ChatWidgetHostControlDocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">InfraStudio Docs</p>
        <h1 className="mt-4 text-4xl font-extrabold text-white">Widget de chat em modo host-controlled</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          O widget agora funciona como uma camada embutida governada pela aplicacao hospedeira. Ele so existe quando o host manda montar e deve ser destruido
          ao sair do contexto autorizado.
        </p>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold text-white">Fluxo recomendado</h2>
            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Passo {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">API global</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>
                  <code>window.InfraChat.mount(config)</code>
                </p>
                <p>
                  <code>window.InfraChat.updateContext(context)</code>
                </p>
                <p>
                  <code>window.InfraChat.hide()</code>
                </p>
                <p>
                  <code>window.InfraChat.destroy()</code>
                </p>
                <p>
                  <code>window.InfraChat.isMounted()</code>
                </p>
                <p>
                  <code>window.InfraChat.getState()</code>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">Logs de ciclo de vida</h2>
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

        <section className="mt-10 rounded-3xl border border-white/10 bg-[#07111f] p-6">
          <h2 className="text-2xl font-bold text-white">Exemplo de controle pelo host</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Este exemplo cobre o caso de detalhe do imovel com unlock, multicliente e destruicao imediata ao sair da rota autorizada.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-slate-200">
            <code>{example}</code>
          </pre>
        </section>
      </div>
    </main>
  );
}
