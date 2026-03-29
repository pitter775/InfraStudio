import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercado-livre-oauth";
import { getConectorById } from "@/lib/conectores";
import { getSessionUser } from "@/lib/session";

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
  const connector = await getConectorById(id);

  if (!connector) {
    return NextResponse.json({ error: "Conector nao encontrado." }, { status: 404 });
  }

  if (!connector.projetoId || !canManageProject(user, connector.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  try {
    const authorizationUrl = await buildMercadoLivreAuthorizationUrl({
      connector,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel iniciar a conexao com o Mercado Livre.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
