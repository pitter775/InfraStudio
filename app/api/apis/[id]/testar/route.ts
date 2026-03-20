import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getApiById, testApi } from "@/lib/apis";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const currentApi = await getApiById(id);

  if (!currentApi) {
    return NextResponse.json({ error: "API nao encontrada." }, { status: 404 });
  }

  if (!canManageProject(user, currentApi.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta API." }, { status: 403 });
  }

  try {
    let body: { context?: Record<string, unknown> | null } | null = null;
    try {
      body = (await _request.json()) as { context?: Record<string, unknown> | null };
    } catch {
      body = null;
    }

    const result = await testApi(
      id,
      body?.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : null,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error, api: result.api, campos: result.campos }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[api/apis/testar] failed to test api", error);
    return NextResponse.json({ error: "Nao foi possivel testar a API." }, { status: 500 });
  }
}
