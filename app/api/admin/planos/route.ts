import { NextResponse } from "next/server";
import { canAccessGlobalAdmin } from "@/lib/access";
import { createPlano, listPlanos } from "@/lib/planos";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const planos = await listPlanos();
  return NextResponse.json({ planos }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        nome?: string;
        precoMensal?: number | string | null;
        limiteTokensTotalMensal?: number | string | null;
        limiteCustoMensal?: number | string | null;
        maxAgentes?: number | string | null;
        maxApis?: number | string | null;
        maxWhatsapp?: number | string | null;
        ativo?: boolean | null;
      }
    | null;

  if (!body?.nome?.trim()) {
    return NextResponse.json({ error: "Nome do plano e obrigatorio." }, { status: 400 });
  }

  const plano = await createPlano({
    nome: body.nome,
    precoMensal: body.precoMensal,
    limiteTokensTotalMensal: body.limiteTokensTotalMensal,
    limiteCustoMensal: body.limiteCustoMensal,
    maxAgentes: body.maxAgentes,
    maxApis: body.maxApis,
    maxWhatsapp: body.maxWhatsapp,
    ativo: body.ativo,
  });

  if (!plano) {
    return NextResponse.json({ error: "Nao foi possivel criar o plano." }, { status: 500 });
  }

  return NextResponse.json({ plano }, { status: 201 });
}
