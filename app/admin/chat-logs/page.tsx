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

function formatPayloadPreview(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
}

export default function AdminChatLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

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

  const handleClearLogs = async () => {
    const confirmed = window.confirm("Remover todos os logs do sistema e de runtime?");
    if (!confirmed) {
      return;
    }

    setClearing(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/chat-logs", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Nao foi possivel remover todos os logs.");
      }

      setLogs([]);
      setFeedback("Todos os logs foram removidos.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel remover todos os logs.");
    } finally {
      setClearing(false);
    }
  };

  const handleCopyLogLine = async (log: SystemLog, index: number) => {
    const compactDetails = buildCompactDetails(log);
    const line = [
      String(index + 1).padStart(3, "0"),
      formatDateTime(log.createdAt),
      log.tipo,
      log.origem,
      log.descricao,
      compactDetails,
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      await navigator.clipboard.writeText(line);
      setCopiedLogId(log.id);
      window.setTimeout(() => {
        setCopiedLogId((current) => (current === log.id ? null : current));
      }, 1600);
    } catch {
      setFeedback("Nao foi possivel copiar a linha do log.");
    }
  };

  return (
    <main className="space-y-5">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Observabilidade</p>
            <h1 className="mt-2 text-[2rem] font-extrabold text-white">Logs</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Lista geral dos eventos de erro mais recentes do sistema. Eventos informativos deixam de ser registrados aqui para reduzir ruido.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleClearLogs()}
            disabled={loading || clearing}
            className="inline-flex items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/16 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearing ? "Removendo logs..." : "Remover todos os logs"}
          </button>
        </div>
        {feedback ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedback.includes("removidos") ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-rose-500/20 bg-rose-500/10 text-rose-100"}`}>
            {feedback}
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
          <CenterLoader />
        </section>
      ) : null}

      <section className="space-y-2">
        {logs.map((log, index) => {
          const compactDetails = buildCompactDetails(log);
          const payloadPreview = formatPayloadPreview(log.payload);
          const lineClass =
            log.level === "error"
              ? "border-red-500/35 bg-[linear-gradient(90deg,rgba(239,68,68,0.2),rgba(127,29,29,0.16))] text-red-100 shadow-[inset_3px_0_0_rgba(248,113,113,0.85)]"
              : "border-white/8 bg-white/[0.03] text-slate-300";
          const subtleTextClass = log.level === "error" ? "text-red-200/80" : "text-slate-500";
          const separatorClass = log.level === "error" ? "text-red-300/35" : "text-slate-600";

          return (
            <article
              key={log.id}
              onClick={() => void handleCopyLogLine(log, index)}
              className={`overflow-x-auto rounded-2xl border px-3 py-2 cursor-pointer transition-colors hover:border-white/15 ${lineClass}`}
              title="Clique para copiar a linha"
            >
              <p className="whitespace-nowrap text-[11px] leading-5">
                <span className={subtleTextClass}>{String(index + 1).padStart(3, "0")}</span>
                <span className={`px-2 ${separatorClass}`}>|</span>
                <span className={subtleTextClass}>{formatDateTime(log.createdAt)}</span>
                <span className={`px-2 ${separatorClass}`}>|</span>
                <span className={log.level === "error" ? "font-bold text-red-50" : "text-slate-200"}>{log.tipo}</span>
                <span className={`px-2 ${separatorClass}`}>|</span>
                <span className={log.level === "error" ? "font-medium text-red-100" : ""}>{log.origem}</span>
                <span className={`px-2 ${separatorClass}`}>|</span>
                <span className={log.level === "error" ? "font-bold text-red-50" : "text-slate-100"}>{log.descricao}</span>
                {compactDetails ? (
                  <>
                    <span className={`px-2 ${separatorClass}`}>|</span>
                    <span className={log.level === "error" ? "text-red-100/95" : "text-slate-400"}>{compactDetails}</span>
                  </>
                ) : null}
                {copiedLogId === log.id ? (
                  <>
                    <span className={`px-2 ${separatorClass}`}>|</span>
                    <span className="font-semibold text-emerald-200">copiado</span>
                  </>
                ) : null}
              </p>
              {payloadPreview ? (
                <pre className={`mt-2 overflow-x-auto rounded-xl border px-3 py-2 text-[10px] leading-5 ${log.level === "error" ? "border-red-400/20 bg-red-950/20 text-red-100/90" : "border-white/10 bg-slate-950/30 text-slate-300"}`}>
                  {payloadPreview}
                </pre>
              ) : null}
            </article>
          );
        })}

        {!loading && !logs.length ? (
          <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
            Ainda nao ha logs de erro para mostrar.
          </section>
        ) : null}
      </section>
    </main>
  );
}
