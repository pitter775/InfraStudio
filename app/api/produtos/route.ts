import { NextResponse } from "next/server";
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
    return NextResponse.json([], { status: 200 });
  }
}
