"use client";

export type ProjetoRow = {
  id: string;
  nome: string;
};

export type ProjetoBilling = {
  canManage: boolean;
  windowLabel: string;
  plan: {
    nomePlano: string;
    limiteTokensTotalMensal: number | null;
    permitirExcedente: boolean;
    bloqueado: boolean;
  };
  currentUsage: {
    totalTokens: number;
    custoTotal: number;
  };
};

export type ProjetoCardData = {
  projetoId: string;
  projetoNome: string;
  billing: ProjetoBilling | null;
};

export type ProjetoStatusTone = {
  label: "normal" | "alerta_80" | "alerta_100" | "bloqueado" | "excedente";
  tone: string;
  badge: string;
};
