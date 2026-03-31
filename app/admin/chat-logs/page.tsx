"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProjectUser } from "@/lib/auth";
import { canAccessGlobalAdmin } from "@/lib/access";

type SystemLog = {
  id: string;
  projetoId: string | null;
  tipo: string;
  origem: string;
  descricao: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  level: "info" | "error";
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
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

function buildCompactDetails(log: SystemLog) {
  const details: string[] = [];
  const payload = log.payload ?? {};

  if (log.projetoId) {
    details.push(`projeto=${log.projetoId}`);
  }

  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const model = typeof payload.model === "string" ? payload.model : null;
  const errorCode = typeof payload.code === "string" ? payload.code : null;
  const errorMessage = typeof payload.message === "string" ? payload.message : null;
  const databaseHost = typeof payload.databaseHost === "string" ? payload.databaseHost : null;
  const estimatedCostUsd = payload.estimatedCostUsd;
  const messageCount = payload.messageCount;
  const tokens =
    payload.tokens && typeof payload.tokens === "object" && !Array.isArray(payload.tokens)
      ? (payload.tokens as Record<string, unknown>)
      : null;

  if (provider) {
    details.push(`provider=${provider}`);
  }

  if (model) {
    details.push(`model=${model}`);
  }

  if (errorCode) {
    details.push(`code=${errorCode}`);
  }

  if (errorMessage) {
    details.push(`motivo=${errorMessage}`);
  }

  if (databaseHost) {
    details.push(`db=${databaseHost}`);
  }

  if (typeof messageCount === "number") {
    details.push(`mensagens=${messageCount}`);
  }

  if (tokens) {
    if (typeof tokens.input === "number") {
      details.push(`in=${tokens.input.toLocaleString("pt-BR")}`);
    }
    if (typeof tokens.output === "number") {
      details.push(`out=${tokens.output.toLocaleString("pt-BR")}`);
    }
  }

  if (typeof estimatedCostUsd === "number") {
    details.push(`usd=${estimatedCostUsd.toFixed(4)}`);
  }

  const payloadKeys = Object.keys(payload).filter((key) =>
    !["provider", "model", "code", "message", "databaseHost", "estimatedCostUsd", "messageCount", "tokens"].includes(key),
  );
  if (payloadKeys.length) {
    details.push(`campos=${payloadKeys.slice(0, 5).join(",")}`);
  }

  return details.join(" | ");
}

export default function AdminChatLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentProjectUser();
      if (!canAccessGlobalAdmin(currentUser)) {
        router.replace("/admin/projetos");
        return;
      }

      const response = await fetch("/api/admin/chat-logs", { cache: "no-store" });
      const payload = (await response.json()) as { logs?: SystemLog[] };
      setLogs(payload.logs ?? []);
      setLoading(false);
    };

    void load();
  }, [router]);

  return (
    <main className="space-y-5">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Observabilidade</p>
        <h1 className="mt-2 text-[2rem] font-extrabold text-white">Logs</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Lista geral dos eventos mais recentes do sistema. A visualizacao foi reduzida para leitura rapida, sem expor todo o conteudo dos chats.
        </p>
      </section>

      {loading ? (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
          <CenterLoader />
        </section>
      ) : null}

      <section className="space-y-2">
        {logs.map((log) => {
          const compactDetails = buildCompactDetails(log);
          const lineClass =
            log.level === "error"
              ? "border-red-500/20 bg-red-500/[0.07] text-red-200"
              : "border-white/8 bg-white/[0.03] text-slate-300";

          return (
            <article key={log.id} className={`overflow-x-auto rounded-2xl border px-3 py-2 ${lineClass}`}>
              <p className="whitespace-nowrap text-[11px] leading-5">
                <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
                <span className="px-2 text-slate-600">|</span>
                <span className={log.level === "error" ? "text-red-200" : "text-slate-200"}>{log.tipo}</span>
                <span className="px-2 text-slate-600">|</span>
                <span>{log.origem}</span>
                <span className="px-2 text-slate-600">|</span>
                <span className={log.level === "error" ? "font-semibold text-red-200" : "text-slate-100"}>{log.descricao}</span>
                {compactDetails ? (
                  <>
                    <span className="px-2 text-slate-600">|</span>
                    <span className={log.level === "error" ? "text-red-100/90" : "text-slate-400"}>{compactDetails}</span>
                  </>
                ) : null}
              </p>
            </article>
          );
        })}

        {!loading && !logs.length ? (
          <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
            Ainda nao ha logs do sistema para mostrar.
          </section>
        ) : null}
      </section>
    </main>
  );
}
