"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";
import { getCurrentProjectUser } from "@/lib/auth";
import { canAccessGlobalAdmin } from "@/lib/access";

// Este componente deixou de ser apenas uma tela de "chat-logs" e hoje funciona como
// laboratorio de observacao operacional, com foco especial no worker do WhatsApp.
// Ao evoluir esta tela, preservar a leitura rapida de runtime, bootstrap e reconexao:
// filtros, busca por channelId/numero/origem/tipo e payload visivel sao parte do uso esperado.
// Se a UX mudar no futuro, considerar renomear a rota/entrada de menu para algo como
// "Observabilidade" sem perder este papel de diagnostico rapido.

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

function isWhatsAppWorkerLog(log: SystemLog) {
  const joined = [log.tipo, log.origem, log.descricao]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return joined.includes("whatsapp") || joined.includes("worker");
}

function isWhatsAppBootstrapLog(log: SystemLog) {
  const joined = [log.tipo, log.origem, log.descricao]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return joined.includes("bootstrap") || joined.includes("reconexao") || joined.includes("reconnect");
}

function extractWorkerChannelId(log: SystemLog) {
  const value = log.payload?.channelId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractWorkerPhone(log: SystemLog) {
  const value = log.payload?.numero;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSearchableText(log: SystemLog) {
  const payload = log.payload ?? {};
  const pieces = [
    log.id,
    log.projetoId,
    log.tipo,
    log.origem,
    log.descricao,
    extractWorkerChannelId(log),
    extractWorkerPhone(log),
    ...Object.entries(payload).flatMap(([key, value]) => {
      if (value == null) {
        return [key];
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return [key, String(value)];
      }

      return [key];
    }),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return pieces;
}

export default function AdminChatLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "whatsapp" | "bootstrap">("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "info">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadLogs = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const currentUser = await getCurrentProjectUser();
      if (!canAccessGlobalAdmin(currentUser)) {
        router.replace("/admin/projetos");
        return;
      }

      const response = await fetch("/api/admin/chat-logs", { cache: "no-store" });
      const payload = (await response.json()) as { logs?: SystemLog[] };
      setLogs(payload.logs ?? []);
    } finally {
      if (options?.silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [router]);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (scope === "whatsapp" && !isWhatsAppWorkerLog(log)) {
        return false;
      }

      if (scope === "bootstrap" && !isWhatsAppBootstrapLog(log)) {
        return false;
      }

      if (levelFilter !== "all" && log.level !== levelFilter) {
        return false;
      }

      if (normalizedQuery && !buildSearchableText(log).includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [levelFilter, logs, scope, searchQuery]);

  const summary = useMemo(() => {
    const whatsappLogs = logs.filter(isWhatsAppWorkerLog);
    const bootstrapLogs = logs.filter(isWhatsAppBootstrapLog);
    const errorLogs = logs.filter((log) => log.level === "error");

    return {
      total: logs.length,
      whatsapp: whatsappLogs.length,
      bootstrap: bootstrapLogs.length,
      errors: errorLogs.length,
    };
  }, [logs]);

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
        <AdminPageHeader
          eyebrow="Observabilidade"
          title="Logs"
          description="Laboratorio de observacao para acompanhar runtime, bootstrap e reconexao do worker do WhatsApp sem depender apenas do card do canal."
          actions={(
            <>
              <button
                type="button"
                onClick={() => void loadLogs({ silent: true })}
                disabled={loading || refreshing}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Atualizando..." : "Atualizar logs"}
              </button>
              <button
                type="button"
                onClick={() => void handleClearLogs()}
                disabled={loading || clearing}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? "Removendo logs..." : "Remover todos os logs"}
              </button>
            </>
          )}
        >
          <p className="mt-2 text-xs text-slate-500">
            A tela agora carrega tudo o que foi persistido e so aplica os filtros visiveis acima.
          </p>
        </AdminPageHeader>
        {feedback ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedback.includes("removidos") ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-rose-500/20 bg-rose-500/10 text-rose-100"}`}>
            {feedback}
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Logs carregados</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Worker WhatsApp</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary.whatsapp}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/80">Bootstrap</p>
            <p className="mt-2 text-2xl font-bold text-amber-50">{summary.bootstrap}</p>
          </div>
          <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-100/80">Erros</p>
            <p className="mt-2 text-2xl font-bold text-rose-50">{summary.errors}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr),auto,auto]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por channelId, numero, origem, tipo ou texto do evento"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { id: "whatsapp", label: "WhatsApp Worker" },
              { id: "bootstrap", label: "Bootstrap" },
              { id: "all", label: "Todos" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setScope(option.id as "all" | "whatsapp" | "bootstrap")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  scope === option.id
                    ? "border-white/12 bg-slate-900/80 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "Tudo" },
              { id: "info", label: "Info" },
              { id: "error", label: "Erro" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLevelFilter(option.id as "all" | "info" | "error")}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  levelFilter === option.id
                    ? "border-emerald-400/25 bg-emerald-500/14 text-emerald-50"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
          <CenterLoader />
        </section>
      ) : null}

      <section className="space-y-2">
        {!loading && visibleLogs.length ? (
          <p className="px-1 text-xs text-slate-500">
            Mostrando {visibleLogs.length} de {logs.length} logs carregados.
          </p>
        ) : null}

        {visibleLogs.map((log, index) => {
          const compactDetails = buildCompactDetails(log);
          const payloadPreview = formatPayloadPreview(log.payload);
          const workerChannelId = extractWorkerChannelId(log);
          const workerPhone = extractWorkerPhone(log);
          const isWorkerLog = isWhatsAppWorkerLog(log);
          const lineClass =
            log.level === "error"
              ? "border-red-500/35 bg-[linear-gradient(90deg,rgba(239,68,68,0.2),rgba(127,29,29,0.16))] text-red-100 shadow-[inset_3px_0_0_rgba(248,113,113,0.85)]"
              : isWorkerLog
                ? "border-white/10 bg-[linear-gradient(90deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] text-slate-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.35)]"
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
              {workerChannelId || workerPhone ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {workerChannelId ? (
                    <span className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200">
                      channel {workerChannelId}
                    </span>
                  ) : null}
                  {workerPhone ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                      numero {workerPhone}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {payloadPreview ? (
                <pre className={`mt-2 overflow-x-auto rounded-xl border px-3 py-2 text-[10px] leading-5 ${log.level === "error" ? "border-red-400/20 bg-red-950/20 text-red-100/90" : "border-white/10 bg-slate-950/30 text-slate-300"}`}>
                  {payloadPreview}
                </pre>
              ) : null}
            </article>
          );
        })}

        {!loading && !visibleLogs.length ? (
          <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
            Nenhum log corresponde aos filtros atuais.
          </section>
        ) : null}
      </section>
    </main>
  );
}
