import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessGlobalAdmin, canAccessProject, canManageProject } from "@/lib/access";
import { listAgentes } from "@/lib/agentes";
import { listApis } from "@/lib/apis";
import { getProjetoBillingOverview, updateProjetoPlanoBilling } from "@/lib/billing-access";
import { applyProjectBillingSelection } from "@/lib/billing-project-snapshot";
import { appendSystemLog } from "@/lib/chat-logs";
import { listChatWidgets } from "@/lib/chat-widgets";
import { listChats } from "@/lib/chats";
import { listConectores } from "@/lib/conectores";
import { getProjetoModeloSelecionado, listModelosDisponiveisParaProjeto } from "@/lib/modelos";
import { getOpenAIModelPricingOptions } from "@/lib/openai-pricing";
import { deleteProjeto, listProjetos, updateProjeto } from "@/lib/projetos";
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

  const [projetos, agentes, chats, apis, widgets, whatsappChannels, conectores, billing, modelosDisponiveis, projetoModeloSelecionado] = await Promise.all([
    listProjetos(),
    listAgentes(id),
    listChats(id),
    listApis(id),
    listChatWidgets(id),
    listWhatsAppChannels(id),
    listConectores(id),
    getProjetoBillingOverview(id),
    listModelosDisponiveisParaProjeto(),
    getProjetoModeloSelecionado(id),
  ]);
  const projeto = projetos.find((item) => item.id === id) ?? null;

  if (!projeto) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    {
      projeto: {
        ...projeto,
        modeloId: projetoModeloSelecionado.modeloId,
        modeloNome: projetoModeloSelecionado.modelo?.nome ?? null,
      },
      modelosDisponiveis,
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
        applyPlano?: boolean | null;
        modoCobranca?: "plano" | "manual" | "ilimitado";
        planoId?: string | null;
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
        permitirExcedente?: boolean | null;
        custoTokenExcedente?: number | string | null;
      }
    | null;

  await appendSystemLog({
    projetoId: id,
    tipo: "billing_update_try",
    origem: "api_admin_projetos",
    descricao: "Tentativa de atualizar billing do projeto.",
    payload: {
      modoCobranca: body?.modoCobranca ?? null,
      planoId: body?.planoId ?? null,
      nomePlano: body?.nomePlano ?? null,
      limiteTokensTotalMensal: body?.limiteTokensTotalMensal ?? null,
      limiteCustoMensal: body?.limiteCustoMensal ?? null,
      permitirExcedente: body?.permitirExcedente ?? null,
      autoBloquear: body?.autoBloquear ?? null,
      bloqueado: body?.bloqueado ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      applyPlano: body?.applyPlano ?? null,
    },
  });

  if (body?.applyPlano === true && body?.modoCobranca && (body.modoCobranca === "ilimitado" || body.planoId)) {
    const result = await applyProjectBillingSelection({
      projetoId: id,
      modoCobranca: body.modoCobranca,
      planoId: body.planoId,
    });

    if (!result.ok) {
      await appendSystemLog({
        projetoId: id,
        tipo: "billing_update_error",
        origem: "api_admin_projetos",
        descricao: "Falha ao aplicar plano centralizado no projeto.",
        payload: {
          modoCobranca: body.modoCobranca,
          planoId: body.planoId ?? null,
          reason: result.reason,
        },
      });

      const status =
        result.reason === "free_plan_limit_reached"
          ? 409
          : result.reason === "project_owner_missing" || result.reason === "plan_not_found"
            ? 400
            : 500;
      const errorMessage =
        result.reason === "free_plan_limit_reached"
          ? "Cada usuario pode ter apenas um projeto com plano free."
          : result.reason === "project_owner_missing"
            ? "Este projeto precisa de um dono principal antes de receber plano free."
            : "Nao foi possivel aplicar o plano ao projeto.";

      return NextResponse.json({ error: errorMessage }, { status });
    }

    await appendSystemLog({
      projetoId: id,
      tipo: "billing_update_ok",
      origem: "api_admin_projetos",
      descricao: "Plano aplicado ao projeto com sucesso.",
      payload: {
        modoCobranca: body.modoCobranca,
        planoId: result.plan.planoId,
        nomePlano: result.plan.nomePlano,
      },
    });

    return NextResponse.json({ plan: result.plan }, { status: 200 });
  }

  if (body?.modoCobranca) {
    const projetos = await listProjetos();
    const projetoAtual = projetos.find((item) => item.id === id);

    if (!projetoAtual) {
      return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
    }

    const projeto = await updateProjeto({
      id,
      nome: projetoAtual.nome,
      slug: projetoAtual.slug,
      tipo: projetoAtual.tipo,
      descricao: projetoAtual.descricao,
      status: projetoAtual.status,
      modoCobranca: body.modoCobranca,
    });

    if (!projeto) {
      await appendSystemLog({
        projetoId: id,
        tipo: "billing_update_error",
        origem: "api_admin_projetos",
        descricao: "Falha ao atualizar modo de cobranca do projeto.",
        payload: {
          modoCobranca: body.modoCobranca,
          planoId: body?.planoId ?? null,
          nomePlano: body?.nomePlano ?? null,
        },
      });
      return NextResponse.json({ error: "Nao foi possivel atualizar o modo de cobranca do projeto." }, { status: 500 });
    }
  }

  const plan = await updateProjetoPlanoBilling({
    projetoId: id,
    planoId: body?.planoId,
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
    permitirExcedente: body?.permitirExcedente,
    custoTokenExcedente: body?.custoTokenExcedente,
  });

  if (!plan) {
    await appendSystemLog({
      projetoId: id,
      tipo: "billing_update_error",
      origem: "api_admin_projetos",
      descricao: "Falha ao salvar snapshot de billing do projeto.",
      payload: {
        modoCobranca: body?.modoCobranca ?? null,
        planoId: body?.planoId ?? null,
        nomePlano: body?.nomePlano ?? null,
      },
    });
    return NextResponse.json({ error: "Nao foi possivel salvar o plano do projeto." }, { status: 500 });
  }

  await appendSystemLog({
    projetoId: id,
    tipo: "billing_update_ok",
    origem: "api_admin_projetos",
    descricao: "Billing do projeto atualizado com sucesso.",
    payload: {
      modoCobranca: body?.modoCobranca ?? null,
      planoId: plan.planoId,
      nomePlano: plan.nomePlano,
    },
  });

  return NextResponse.json({ plan }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user) || !canAccessAdmin(user)) {
    return NextResponse.json({ error: "Apenas admin pode excluir projetos." }, { status: 403 });
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
