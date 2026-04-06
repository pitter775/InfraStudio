"use client";

import type { ProjetoCardData, ProjetoStatusTone } from "./types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR");
}

export function getProjectStatus(item: ProjetoCardData): ProjetoStatusTone {
  const plan = item.billing?.plan;
  const usage = item.billing?.currentUsage;
  const tokenLimit = plan?.limiteTokensTotalMensal ?? null;
  const totalTokens = usage?.totalTokens ?? 0;
  const excedenteAtivo = Boolean(plan?.permitirExcedente && tokenLimit !== null && totalTokens > tokenLimit);

  if (plan?.bloqueado) {
    return {
      label: "bloqueado",
      tone: "bg-rose-500",
      badge: "bg-rose-500/12 text-rose-200",
    };
  }

  if (excedenteAtivo) {
    return {
      label: "excedente",
      tone: "bg-sky-500",
      badge: "bg-sky-500/12 text-sky-200",
    };
  }

  if (tokenLimit !== null && tokenLimit > 0 && totalTokens >= tokenLimit) {
    return {
      label: "alerta_100",
      tone: "bg-orange-500",
      badge: "bg-orange-500/12 text-orange-200",
    };
  }

  if (tokenLimit !== null && tokenLimit > 0 && totalTokens >= tokenLimit * 0.8) {
    return {
      label: "alerta_80",
      tone: "bg-amber-400",
      badge: "bg-amber-400/12 text-amber-100",
    };
  }

  return {
    label: "normal",
    tone: "bg-emerald-500",
    badge: "bg-emerald-500/12 text-emerald-200",
  };
}

export function getProgressValue(item: ProjetoCardData) {
  const tokenLimit = item.billing?.plan.limiteTokensTotalMensal ?? null;
  const totalTokens = item.billing?.currentUsage.totalTokens ?? 0;

  if (tokenLimit === null || tokenLimit <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((totalTokens / tokenLimit) * 100, 100));
}
