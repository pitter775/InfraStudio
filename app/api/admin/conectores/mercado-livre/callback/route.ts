import { NextResponse } from "next/server";
import { completeMercadoLivreOAuthCallback } from "@/lib/mercado-livre-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const { projetoId } = await completeMercadoLivreOAuthCallback(url.searchParams);
    return NextResponse.redirect(new URL(`/admin/projetos/${projetoId}?mercado_livre_oauth=success`, url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel concluir a conexao com o Mercado Livre.";
    return NextResponse.redirect(new URL(`/admin/projetos?mercado_livre_oauth_error=${encodeURIComponent(message)}`, url.origin));
  }
}
