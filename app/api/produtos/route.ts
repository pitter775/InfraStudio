import { NextResponse } from "next/server";
import { appendSystemLog } from "@/lib/chat-logs";
import { buscarProdutosMercadoLivrePorAgente } from "@/lib/mercado-livre";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("termo")?.trim() ?? "";
  const agenteId = searchParams.get("agente_id")?.trim() ?? "";

  if (!termo || !agenteId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const produtos = await buscarProdutosMercadoLivrePorAgente(agenteId, termo);
    return NextResponse.json(produtos, { status: 200 });
  } catch (error) {
    console.error("[api/produtos] failed to fetch products", error);
    await appendSystemLog({
      tipo: "mercado_livre_search_route_error",
      origem: "api_produtos",
      descricao: "A rota publica de produtos falhou ao consultar o Mercado Livre.",
      payload: {
        agenteId,
        termo,
        message: error instanceof Error ? error.message : "Erro desconhecido.",
      },
    });
    return NextResponse.json([], { status: 200 });
  }
}
