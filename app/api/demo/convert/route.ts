import { NextResponse } from "next/server";
import { convertDemoProjectToRealProject } from "@/lib/demo-project-service";
import { getDemoProjectAccessState } from "@/lib/demo-project-guard";
import { isDemoUser } from "@/lib/demo-user";
import { createSession, getSessionUser } from "@/lib/session";
import { getUsuarioById } from "@/lib/usuarios";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (isDemoUser(user.email)) {
    return NextResponse.json({ error: "Converta para uma conta real antes de continuar." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    demoProjectId?: string;
  } | null;

  if (!body?.demoProjectId) {
    return NextResponse.json({ error: "Projeto demo invalido." }, { status: 400 });
  }

  const access = await getDemoProjectAccessState(user, body.demoProjectId);
  if (!access.projeto?.isDemo || !access.canAccess) {
    return NextResponse.json({ error: "Projeto demo invalido." }, { status: 400 });
  }

  if (access.expired || access.projeto.demoStatus !== "ativo") {
    return NextResponse.json({ error: "DEMO_EXPIRED" }, { status: 409 });
  }

  const projetoReal = await convertDemoProjectToRealProject({
    demoProjetoId: body.demoProjectId,
    usuarioId: user.id,
  });

  if (!projetoReal) {
    return NextResponse.json({ error: "Nao foi possivel converter o projeto demo." }, { status: 500 });
  }

  const refreshedUser = await getUsuarioById(user.id);
  if (refreshedUser) {
    await createSession(refreshedUser);
  }

  return NextResponse.json({ projetoId: projetoReal.id }, { status: 200 });
}
