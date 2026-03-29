"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProjectUser } from "@/lib/auth";
import { canAccessGlobalAdmin } from "@/lib/access";

type ChatLog = {
  id: string;
  projetoId: string | null;
  tipo: string;
  origem: string;
  descricao: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function readPayloadObject(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function CenterLoader() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
        <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
        <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
      </div>
    </div>
  );
}

export default function AdminChatLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentProjectUser();
      if (!canAccessGlobalAdmin(currentUser)) {
        router.replace("/admin/projetos");
        return;
      }

      const response = await fetch("/api/admin/chat-logs", { cache: "no-store" });
      const payload = (await response.json()) as { logs?: ChatLog[] };
      setLogs(payload.logs ?? []);
      setLoading(false);
    };

    void load();
  }, [router]);

  return (
    <main className="space-y-5">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Observabilidade</p>
        <h1 className="mt-2 text-[2rem] font-extrabold text-white">Logs de Chat</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Aqui voce consegue inspecionar o snapshot do que foi enviado ao modelo: resumo atual, payload montado, quantidade de mensagens no contexto, tokens e custo estimado.
        </p>
      </section>

      {loading ? (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
          <CenterLoader />
        </section>
      ) : null}

      <section className="space-y-4">
        {logs.map((log) => {
          const tokens = readPayloadObject(log.payload, "tokens");
          const requestDebug = readPayloadObject(log.payload, "requestDebug");
          const requestPayload = readPayloadObject(requestDebug, "requestPayload");
          const input = Array.isArray(requestPayload?.input) ? requestPayload.input : [];

          return (
            <article key={log.id} className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{log.descricao}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                    In {formatInteger(Number(tokens?.input ?? 0))}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                    Out {formatInteger(Number(tokens?.output ?? 0))}
                  </span>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                    contexto {formatInteger(input.length)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-[18px] border border-white/8 bg-slate-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Resumo atual</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                    {String(log.payload?.summary ?? "Sem resumo salvo")}
                  </pre>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-slate-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ultima mensagem</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                    {String(log.payload?.latestUserMessage ?? "Sem mensagem")}
                  </pre>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-slate-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Resposta gerada</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                    {String(log.payload?.replyPreview ?? "Sem resposta")}
                  </pre>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[18px] border border-white/8 bg-slate-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payload enviado</p>
                  <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-200 [scrollbar-width:thin]">
                    {JSON.stringify(requestPayload ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-slate-950/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Metadados do request</p>
                  <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-200 [scrollbar-width:thin]">
                    {JSON.stringify(
                      {
                        provider: log.payload?.provider ?? null,
                        model: log.payload?.model ?? null,
                        estimatedCostUsd: log.payload?.estimatedCostUsd ?? null,
                        messageCount: log.payload?.messageCount ?? null,
                        requestDebug,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && !logs.length ? (
          <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
            Ainda nao ha logs de requisicao do chat para mostrar.
          </section>
        ) : null}
      </section>
    </main>
  );
}
