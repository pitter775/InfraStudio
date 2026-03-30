import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject, canManageProject } from "@/lib/access";
import { listAgentes } from "@/lib/agentes";
import { listApis } from "@/lib/apis";
import { getProjetoBillingOverview, updateProjetoPlanoBilling } from "@/lib/billing";
import { appendSystemLog } from "@/lib/chat-logs";
import { listChatWidgets } from "@/lib/chat-widgets";
import { listChats } from "@/lib/chats";
import { listConectores } from "@/lib/conectores";
import { getOpenAIModelPricingOptions } from "@/lib/openai-pricing";
import { deleteProjeto, listProjetos } from "@/lib/projetos";
import { getSessionUser } from "@/lib/session";
import { listWhatsAppChannels } from "@/lib/whatsapp-channels";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  if (!canAccessProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const [projetos, agentes, chats, apis, widgets, whatsappChannels, conectores, billing] = await Promise.all([
    listProjetos(),
    listAgentes(id),
    listChats(id),
    listApis(id),
    listChatWidgets(id),
    listWhatsAppChannels(id),
    listConectores(id),
    getProjetoBillingOverview(id),
  ]);
  const projeto = projetos.find((item) => item.id === id) ?? null;

  if (!projeto) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    {
      projeto,
      agentes,
      apis,
      conectores,
      widgets,
      whatsappChannels,
      chats,
      billing: billing
        ? {
            canManage: canManageProject(user, id),
            windowLabel: billing.window.label,
            plan: billing.plano,
            currentUsage: billing.consumoAtual,
            pricingModels: getOpenAIModelPricingOptions(),
          }
        : null,
      stats: {
        totalAgentes: agentes.length,
        agenteAtivoId: agentes.find((agente) => agente.ativo)?.id ?? null,
        totalApis: apis.length,
        totalConectores: conectores.length,
        totalWidgets: widgets.length,
        totalWhatsAppChannels: whatsappChannels.length,
        totalChats: chats.length,
      },
    },
    { status: 200 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!canManageProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para gerenciar este projeto." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        nomePlano?: string | null;
        modeloReferencia?: string | null;
        limiteTokensInputMensal?: number | string | null;
        limiteTokensOutputMensal?: number | string | null;
        limiteTokensTotalMensal?: number | string | null;
        limiteCustoMensal?: number | string | null;
        autoBloquear?: boolean | null;
        bloqueado?: boolean | null;
        bloqueadoMotivo?: string | null;
        observacoes?: string | null;
      }
    | null;

  const plan = await updateProjetoPlanoBilling({
    projetoId: id,
    nomePlano: body?.nomePlano,
    modeloReferencia: body?.modeloReferencia,
    limiteTokensInputMensal: body?.limiteTokensInputMensal,
    limiteTokensOutputMensal: body?.limiteTokensOutputMensal,
    limiteTokensTotalMensal: body?.limiteTokensTotalMensal,
    limiteCustoMensal: body?.limiteCustoMensal,
    autoBloquear: body?.autoBloquear,
    bloqueado: body?.bloqueado,
    bloqueadoMotivo: body?.bloqueadoMotivo,
    observacoes: body?.observacoes,
  });

  if (!plan) {
    return NextResponse.json({ error: "Nao foi possivel salvar o plano do projeto." }, { status: 500 });
  }

  return NextResponse.json({ plan }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!user?.isMaster || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Apenas o master pode excluir projetos." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!canManageProject(user, id)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const deleted = await deleteProjeto(id);
  if (!deleted.ok) {
    await appendSystemLog({
      projetoId: id,
      tipo: "project_delete_failure",
      origem: "api.admin.projetos.delete",
      descricao: "Exclusao de projeto falhou.",
      payload: {
        step: deleted.step ?? null,
        message: deleted.error ?? null,
      },
    });

    return NextResponse.json(
      {
        error: deleted.step
          ? `Nao foi possivel excluir o projeto. Falha em: ${deleted.step}.`
          : "Nao foi possivel excluir o projeto.",
        detail: deleted.error ?? null,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
