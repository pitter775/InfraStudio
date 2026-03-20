import { NextResponse } from "next/server";
import { getAgenteAtivo, getAgenteByIdentifier } from "@/lib/agentes";
import { getChatWidgetByProjetoAgente } from "@/lib/chat-widgets";
import { getProjetoByIdentifier } from "@/lib/projetos";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: Request) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));

  try {
    const { searchParams } = new URL(request.url);
    const projetoIdentifier = searchParams.get("projeto")?.trim() || "";
    const agenteIdentifier = searchParams.get("agente")?.trim() || "";

    if (!projetoIdentifier) {
      return NextResponse.json({ error: "Parametro `projeto` obrigatorio." }, { status: 400, headers: corsHeaders });
    }

    const projeto = await getProjetoByIdentifier(projetoIdentifier);
    if (!projeto) {
      return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404, headers: corsHeaders });
    }

    let agente = agenteIdentifier ? await getAgenteByIdentifier(agenteIdentifier, projeto.id) : null;

    if (!agente) {
      agente = await getAgenteAtivo(projeto.id);
    }
    const widget = await getChatWidgetByProjetoAgente({ projetoId: projeto.id, agenteId: agente?.id ?? null });

    return NextResponse.json(
      {
        projeto: {
          id: projeto.id,
          slug: projeto.slug,
          nome: projeto.nome,
        },
        agente: agente
          ? {
              id: agente.id,
              slug: agente.slug,
              nome: agente.nome,
            }
          : null,
        ui: {
          title: widget?.nome ?? agente?.nome ?? projeto.nome ?? "Chat",
          theme: widget?.tema ?? null,
          accent: widget?.corPrimaria ?? null,
          transparent: widget?.fundoTransparente ?? null,
        },
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[chat-config] failed to resolve chat config", error);
    return NextResponse.json({ error: "Nao foi possivel carregar a configuracao." }, { status: 500, headers: corsHeaders });
  }
}
