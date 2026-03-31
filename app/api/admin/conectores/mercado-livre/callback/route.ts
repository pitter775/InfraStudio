import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import { completeMercadoLivreOAuthCallback } from "@/lib/mercado-livre-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const { projetoId, connector } = await completeMercadoLivreOAuthCallback(url.searchParams, url.origin);
    await appendSystemLog({
      projetoId,
      tipo: "mercado_livre_oauth_callback_success",
      origem: "api_admin_conectores_mercado_livre_callback",
      descricao: "OAuth do Mercado Livre concluido com sucesso.",
      payload: {
        connectorId: connector.id,
        connectorName: connector.nome,
        projetoId,
        hasCode: Boolean(url.searchParams.get("code")),
        hasState: Boolean(url.searchParams.get("state")),
      },
    });
    return NextResponse.redirect(new URL(`/admin/projetos/${projetoId}?mercado_livre_oauth=success`, url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel concluir a conexao com o Mercado Livre.";
    await appendSystemLog({
      tipo: "mercado_livre_oauth_callback_error",
      origem: "api_admin_conectores_mercado_livre_callback",
      descricao: "Falha ao concluir o OAuth do Mercado Livre.",
      payload: {
        message,
        origin: url.origin,
        hasCode: Boolean(url.searchParams.get("code")),
        hasState: Boolean(url.searchParams.get("state")),
        oauthError: url.searchParams.get("error") || null,
      },
    });
    return NextResponse.redirect(new URL(`/admin/projetos?mercado_livre_oauth_error=${encodeURIComponent(message)}`, url.origin));
  }
}
