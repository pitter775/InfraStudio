import "server-only";

import { canAccessGlobalAdmin, canAccessProject, resolveCurrentProjectId } from "@/lib/access";
import type { AppUser } from "@/lib/app-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const FEEDBACK_CATEGORIAS = ["sugestao", "reclamacao", "melhoria", "duvida", "outro"] as const;
export const FEEDBACK_STATUSES = ["novo", "em_andamento", "respondido", "fechado"] as const;
export const FEEDBACK_ORDENACOES = ["recentes", "pendentes"] as const;

export type FeedbackCategoria = (typeof FEEDBACK_CATEGORIAS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackOrdenacao = (typeof FEEDBACK_ORDENACOES)[number];
export type FeedbackRemetenteTipo = "usuario" | "admin";

export type FeedbackResumo = {
  pendentesAdmin: number;
  respostasNaoLidasUsuario: number;
};

export type FeedbackMensagemRecord = {
  id: string;
  feedbackId: string;
  usuarioId: string | null;
  remetenteTipo: FeedbackRemetenteTipo;
  mensagem: string;
  lidaPeloAdmin: boolean;
  lidaPeloUsuario: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackRecord = {
  id: string;
  usuarioId: string;
  projetoId: string | null;
  assunto: string;
  categoria: FeedbackCategoria;
  status: FeedbackStatus;
  adminVisualizado: boolean;
  usuarioVisualizado: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  usuario: {
    id: string;
    nome: string | null;
    email: string | null;
  };
  projeto: {
    id: string | null;
    nome: string | null;
  } | null;
  totalMensagens: number;
  ultimaMensagem: string | null;
  ultimaMensagemAt: string;
  possuiMensagemNaoLidaAdmin: boolean;
  possuiMensagemNaoLidaUsuario: boolean;
  mensagensNaoLidasAdmin: number;
  mensagensNaoLidasUsuario: number;
};

export type FeedbackDetalheRecord = FeedbackRecord & {
  mensagens: FeedbackMensagemRecord[];
};

type FeedbackUsuarioRow =
  | {
      id: string;
      nome: string | null;
      email: string | null;
    }
  | {
      id: string;
      nome: string | null;
      email: string | null;
    }[]
  | null;

type FeedbackProjetoRow =
  | {
      id: string;
      nome: string | null;
    }
  | {
      id: string;
      nome: string | null;
    }[]
  | null;

type FeedbackRow = {
  id: string;
  usuario_id: string;
  projeto_id: string | null;
  assunto: string | null;
  categoria: string | null;
  status: string | null;
  admin_visualizado: boolean | null;
  usuario_visualizado: boolean | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  usuarios: FeedbackUsuarioRow;
  projetos: FeedbackProjetoRow;
};

type FeedbackMensagemRow = {
  id: string;
  feedback_id: string;
  usuario_id: string | null;
  remetente_tipo: string | null;
  mensagem: string | null;
  lida_pelo_admin: boolean | null;
  lida_pelo_usuario: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function isFeedbackCategoria(value: string | null | undefined): value is FeedbackCategoria {
  return FEEDBACK_CATEGORIAS.includes((value ?? "") as FeedbackCategoria);
}

function isFeedbackStatus(value: string | null | undefined): value is FeedbackStatus {
  return FEEDBACK_STATUSES.includes((value ?? "") as FeedbackStatus);
}

function isFeedbackOrdenacao(value: string | null | undefined): value is FeedbackOrdenacao {
  return FEEDBACK_ORDENACOES.includes((value ?? "") as FeedbackOrdenacao);
}

function mapUsuarioRow(value: FeedbackUsuarioRow) {
  const row = Array.isArray(value) ? value[0] ?? null : value;

  return {
    id: row?.id ?? "",
    nome: row?.nome?.trim() || null,
    email: row?.email?.trim() || null,
  };
}

function mapProjetoRow(value: FeedbackProjetoRow) {
  const row = Array.isArray(value) ? value[0] ?? null : value;

  if (!row) {
    return null;
  }

  return {
    id: row.id ?? null,
    nome: row.nome?.trim() || null,
  };
}

function mapMensagem(row: FeedbackMensagemRow): FeedbackMensagemRecord {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    usuarioId: row.usuario_id ?? null,
    remetenteTipo: row.remetente_tipo === "admin" ? "admin" : "usuario",
    mensagem: row.mensagem?.trim() || "",
    lidaPeloAdmin: row.lida_pelo_admin === true,
    lidaPeloUsuario: row.lida_pelo_usuario === true,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function buildFeedbackRecord(row: FeedbackRow, mensagens: FeedbackMensagemRecord[]): FeedbackRecord {
  const ultimaMensagem = mensagens[mensagens.length - 1] ?? null;
  const usuario = mapUsuarioRow(row.usuarios);

  return {
    id: row.id,
    usuarioId: row.usuario_id,
    projetoId: row.projeto_id ?? null,
    assunto: row.assunto?.trim() || "Sem assunto",
    categoria: isFeedbackCategoria(row.categoria) ? row.categoria : "outro",
    status: isFeedbackStatus(row.status) ? row.status : "novo",
    adminVisualizado: row.admin_visualizado === true,
    usuarioVisualizado: row.usuario_visualizado === true,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
    usuario,
    projeto: mapProjetoRow(row.projetos),
    totalMensagens: mensagens.length,
    ultimaMensagem: ultimaMensagem?.mensagem ?? null,
    ultimaMensagemAt: ultimaMensagem?.createdAt ?? row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
    possuiMensagemNaoLidaAdmin: mensagens.some((mensagem) => !mensagem.lidaPeloAdmin),
    possuiMensagemNaoLidaUsuario: mensagens.some((mensagem) => !mensagem.lidaPeloUsuario),
    mensagensNaoLidasAdmin: mensagens.filter((mensagem) => !mensagem.lidaPeloAdmin).length,
    mensagensNaoLidasUsuario: mensagens.filter((mensagem) => !mensagem.lidaPeloUsuario).length,
  };
}

function ordenarFeedbacks(feedbacks: FeedbackRecord[], ordenacao: FeedbackOrdenacao) {
  if (ordenacao === "pendentes") {
    const prioridadeStatus: Record<FeedbackStatus, number> = {
      novo: 0,
      em_andamento: 1,
      respondido: 2,
      fechado: 3,
    };

    return [...feedbacks].sort((left, right) => {
      const leftPendente = Number(left.status === "novo" || left.possuiMensagemNaoLidaAdmin);
      const rightPendente = Number(right.status === "novo" || right.possuiMensagemNaoLidaAdmin);

      if (leftPendente !== rightPendente) {
        return rightPendente - leftPendente;
      }

      const diffStatus = prioridadeStatus[left.status] - prioridadeStatus[right.status];
      if (diffStatus !== 0) {
        return diffStatus;
      }

      return new Date(right.ultimaMensagemAt).getTime() - new Date(left.ultimaMensagemAt).getTime();
    });
  }

  return [...feedbacks].sort(
    (left, right) => new Date(right.ultimaMensagemAt).getTime() - new Date(left.ultimaMensagemAt).getTime(),
  );
}

async function listMensagensPorFeedbackIds(feedbackIds: string[]) {
  if (!feedbackIds.length) {
    return new Map<string, FeedbackMensagemRecord[]>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feedback_mensagens")
    .select("id, feedback_id, usuario_id, remetente_tipo, mensagem, lida_pelo_admin, lida_pelo_usuario, created_at, updated_at")
    .in("feedback_id", feedbackIds)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[feedbacks] failed to list mensagens", error);
    return new Map<string, FeedbackMensagemRecord[]>();
  }

  const mensagensPorFeedback = new Map<string, FeedbackMensagemRecord[]>();

  for (const raw of data as FeedbackMensagemRow[]) {
    const mensagem = mapMensagem(raw);
    const bucket = mensagensPorFeedback.get(mensagem.feedbackId) ?? [];
    bucket.push(mensagem);
    mensagensPorFeedback.set(mensagem.feedbackId, bucket);
  }

  return mensagensPorFeedback;
}

async function getFeedbackRowById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feedbacks")
    .select("id, usuario_id, projeto_id, assunto, categoria, status, admin_visualizado, usuario_visualizado, closed_at, created_at, updated_at, usuarios(id, nome, email), projetos(id, nome)")
    .eq("id", id)
    .maybeSingle<FeedbackRow>();

  if (error) {
    console.error("[feedbacks] failed to load feedback", error);
    return null;
  }

  return data ?? null;
}

function canAccessFeedback(user: AppUser, feedback: { usuario_id: string; projeto_id: string | null }) {
  if (canAccessGlobalAdmin(user)) {
    return true;
  }

  return feedback.usuario_id === user.id;
}

export async function listFeedbacks(input: {
  user: AppUser;
  status?: string | null;
  categoria?: string | null;
  usuarioId?: string | null;
  ordenacao?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const admin = canAccessGlobalAdmin(input.user);
  const ordenacao = isFeedbackOrdenacao(input.ordenacao) ? input.ordenacao : "recentes";
  let query = supabase
    .from("feedbacks")
    .select("id, usuario_id, projeto_id, assunto, categoria, status, admin_visualizado, usuario_visualizado, closed_at, created_at, updated_at, usuarios(id, nome, email), projetos(id, nome)")
    .order("updated_at", { ascending: false });

  if (!admin) {
    query = query.eq("usuario_id", input.user.id);
  } else if (input.usuarioId?.trim()) {
    query = query.eq("usuario_id", input.usuarioId.trim());
  }

  if (isFeedbackStatus(input.status)) {
    query = query.eq("status", input.status);
  }

  if (isFeedbackCategoria(input.categoria)) {
    query = query.eq("categoria", input.categoria);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[feedbacks] failed to list feedbacks", error);
    return {
      feedbacks: [] as FeedbackRecord[],
      filtros: {
        usuarios: [] as Array<{ id: string; nome: string; email: string | null }>,
      },
    };
  }

  const rows = data as FeedbackRow[];
  const mensagensPorFeedback = await listMensagensPorFeedbackIds(rows.map((item) => item.id));
  const feedbacks = ordenarFeedbacks(
    rows.map((row) => buildFeedbackRecord(row, mensagensPorFeedback.get(row.id) ?? [])),
    admin ? ordenacao : "recentes",
  );

  const usuarios = admin
    ? Array.from(
        new Map(
          feedbacks.map((feedback) => [
            feedback.usuarioId,
            {
              id: feedback.usuarioId,
              nome: feedback.usuario.nome ?? "Usuario",
              email: feedback.usuario.email,
            },
          ]),
        ).values(),
      ).sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    : [];

  return {
    feedbacks,
    filtros: {
      usuarios,
    },
  };
}

export async function getFeedbackDetalhe(user: AppUser, feedbackId: string): Promise<FeedbackDetalheRecord | null | false> {
  const row = await getFeedbackRowById(feedbackId);
  if (!row) {
    return null;
  }

  if (!canAccessFeedback(user, row)) {
    return false;
  }

  const mensagensPorFeedback = await listMensagensPorFeedbackIds([feedbackId]);
  return {
    ...buildFeedbackRecord(row, mensagensPorFeedback.get(feedbackId) ?? []),
    mensagens: mensagensPorFeedback.get(feedbackId) ?? [],
  } satisfies FeedbackDetalheRecord;
}

export async function marcarFeedbackComoLido(user: AppUser, feedbackId: string): Promise<FeedbackDetalheRecord | null | false> {
  const feedback = await getFeedbackDetalhe(user, feedbackId);
  if (!feedback) {
    return feedback;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (canAccessGlobalAdmin(user)) {
    const [{ error: feedbackError }, { error: mensagensError }] = await Promise.all([
      supabase
        .from("feedbacks")
        .update({
          admin_visualizado: true,
          updated_at: now,
        } as never)
        .eq("id", feedbackId),
      supabase
        .from("feedback_mensagens")
        .update({
          lida_pelo_admin: true,
          updated_at: now,
        } as never)
        .eq("feedback_id", feedbackId)
        .eq("remetente_tipo", "usuario")
        .eq("lida_pelo_admin", false),
    ]);

    if (feedbackError || mensagensError) {
      console.error("[feedbacks] failed to mark feedback as read by admin", feedbackError ?? mensagensError);
    }
  } else {
    const [{ error: feedbackError }, { error: mensagensError }] = await Promise.all([
      supabase
        .from("feedbacks")
        .update({
          usuario_visualizado: true,
          updated_at: now,
        } as never)
        .eq("id", feedbackId),
      supabase
        .from("feedback_mensagens")
        .update({
          lida_pelo_usuario: true,
          updated_at: now,
        } as never)
        .eq("feedback_id", feedbackId)
        .eq("remetente_tipo", "admin")
        .eq("lida_pelo_usuario", false),
    ]);

    if (feedbackError || mensagensError) {
      console.error("[feedbacks] failed to mark feedback as read by usuario", feedbackError ?? mensagensError);
    }
  }

  return await getFeedbackDetalhe(user, feedbackId);
}

export async function createFeedback(input: {
  user: AppUser;
  projetoId?: string | null;
  assunto: string;
  categoria: FeedbackCategoria;
  mensagemInicial: string;
}): Promise<FeedbackDetalheRecord | null | false> {
  const assunto = input.assunto.trim();
  const mensagemInicial = input.mensagemInicial.trim();

  if (!assunto || !mensagemInicial) {
    return null;
  }

  const projetoId = input.projetoId?.trim() || resolveCurrentProjectId(input.user) || null;
  if (projetoId && !canAccessGlobalAdmin(input.user) && !canAccessProject(input.user, projetoId)) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      usuario_id: input.user.id,
      projeto_id: projetoId,
      assunto,
      categoria: input.categoria,
      status: "novo",
      admin_visualizado: false,
      usuario_visualizado: true,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[feedbacks] failed to create feedback", error);
    return null;
  }

  const { error: mensagemError } = await supabase.from("feedback_mensagens").insert({
    feedback_id: data.id,
    usuario_id: input.user.id,
    remetente_tipo: "usuario",
    mensagem: mensagemInicial,
    lida_pelo_admin: false,
    lida_pelo_usuario: true,
    created_at: now,
    updated_at: now,
  } as never);

  if (mensagemError) {
    console.error("[feedbacks] failed to create first mensagem", mensagemError);
    await supabase.from("feedbacks").delete().eq("id", data.id);
    return null;
  }

  return await getFeedbackDetalhe(input.user, data.id);
}

export async function adicionarMensagemFeedback(input: {
  user: AppUser;
  feedbackId: string;
  mensagem: string;
  statusAdmin?: string | null;
}): Promise<FeedbackDetalheRecord | null | false> {
  const feedback = await getFeedbackDetalhe(input.user, input.feedbackId);
  if (!feedback) {
    return feedback;
  }

  if (feedback.status === "fechado") {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const mensagem = input.mensagem.trim();

  if (!mensagem) {
    return null;
  }

  const remetenteTipo: FeedbackRemetenteTipo = canAccessGlobalAdmin(input.user) ? "admin" : "usuario";
  const { error: mensagemError } = await supabase.from("feedback_mensagens").insert({
    feedback_id: input.feedbackId,
    usuario_id: input.user.id,
    remetente_tipo: remetenteTipo,
    mensagem,
    lida_pelo_admin: remetenteTipo === "admin",
    lida_pelo_usuario: remetenteTipo === "usuario",
    created_at: now,
    updated_at: now,
  } as never);

  if (mensagemError) {
    console.error("[feedbacks] failed to add mensagem", mensagemError);
    return null;
  }

  const nextStatus: FeedbackStatus =
    remetenteTipo === "admin"
      ? isFeedbackStatus(input.statusAdmin)
        ? input.statusAdmin
        : "respondido"
      : feedback.status === "respondido"
        ? "em_andamento"
        : feedback.status;

  const { error: feedbackError } = await supabase
    .from("feedbacks")
    .update({
      status: nextStatus,
      admin_visualizado: remetenteTipo === "admin",
      usuario_visualizado: remetenteTipo !== "admin",
      closed_at: nextStatus === "fechado" ? now : null,
      updated_at: now,
    } as never)
    .eq("id", input.feedbackId);

  if (feedbackError) {
    console.error("[feedbacks] failed to update feedback after mensagem", feedbackError);
    return null;
  }

  return await getFeedbackDetalhe(input.user, input.feedbackId);
}

export async function atualizarStatusFeedback(input: {
  user: AppUser;
  feedbackId: string;
  status?: string | null;
  acao?: "reabrir" | null;
}): Promise<FeedbackDetalheRecord | null | false> {
  const feedback = await getFeedbackDetalhe(input.user, input.feedbackId);
  if (!feedback) {
    return feedback;
  }

  const admin = canAccessGlobalAdmin(input.user);
  const now = new Date().toISOString();
  let nextStatus: FeedbackStatus | null = null;

  if (input.acao === "reabrir") {
    if (admin || feedback.usuarioId === input.user.id) {
      nextStatus = "em_andamento";
    }
  } else if (admin && isFeedbackStatus(input.status)) {
    nextStatus = input.status;
  }

  if (!nextStatus) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("feedbacks")
    .update({
      status: nextStatus,
      closed_at: nextStatus === "fechado" ? now : null,
      updated_at: now,
    } as never)
    .eq("id", input.feedbackId);

  if (error) {
    console.error("[feedbacks] failed to update status", error);
    return null;
  }

  return await getFeedbackDetalhe(input.user, input.feedbackId);
}

export async function getFeedbackResumo(user: AppUser): Promise<FeedbackResumo> {
  const supabase = getSupabaseAdminClient();
  const admin = canAccessGlobalAdmin(user);
  const feedbacksQuery = supabase
    .from("feedbacks")
    .select("id, admin_visualizado, usuario_visualizado, usuario_id");

  const feedbacksResponse = await (admin ? feedbacksQuery : feedbacksQuery.eq("usuario_id", user.id));

  const feedbacksRows = (feedbacksResponse.data ?? []) as Array<{
    id: string;
    admin_visualizado: boolean | null;
    usuario_visualizado: boolean | null;
    usuario_id: string;
  }>;

  const feedbackIds = feedbacksRows.map((item) => item.id);
  const mensagensResponse = feedbackIds.length
    ? await supabase
        .from("feedback_mensagens")
        .select("feedback_id, lida_pelo_admin, lida_pelo_usuario")
        .in("feedback_id", feedbackIds)
    : { data: [] };
  const mensagensRows = (mensagensResponse.data ?? []) as Array<{
    feedback_id: string;
    lida_pelo_admin: boolean | null;
    lida_pelo_usuario: boolean | null;
  }>;

  const pendentesAdmin = new Set<string>();
  const respostasNaoLidasUsuario = new Set<string>();

  for (const feedback of feedbacksRows) {
    if (admin && feedback.admin_visualizado !== true) {
      pendentesAdmin.add(feedback.id);
    }

    if (!admin && feedback.usuario_visualizado !== true) {
      respostasNaoLidasUsuario.add(feedback.id);
    }
  }

  for (const mensagem of mensagensRows) {
    if (admin && mensagem.lida_pelo_admin !== true) {
      pendentesAdmin.add(mensagem.feedback_id);
    }

    if (!admin && mensagem.lida_pelo_usuario !== true) {
      respostasNaoLidasUsuario.add(mensagem.feedback_id);
    }
  }

  return {
    pendentesAdmin: pendentesAdmin.size,
    respostasNaoLidasUsuario: respostasNaoLidasUsuario.size,
  };
}
