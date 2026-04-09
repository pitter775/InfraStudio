import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { getSessionUser } from "@/lib/session";
import { createProjetoForUsuario, updateProjeto } from "@/lib/projetos";
import { createAgente } from "@/lib/agentes";
import { createApi } from "@/lib/apis";
import { isDemoUser } from "@/lib/demo-user";
import type { PendingDemoConversion } from "@/lib/demo-conversion";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUsuarioById, setUsuarioAtivo } from "@/lib/usuarios";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (isDemoUser(user.email)) {
    return NextResponse.json({ error: "Converta para uma conta real antes de continuar." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as PendingDemoConversion | null;
  if (!body?.demoUserId || !body.snapshot?.projeto) {
    return NextResponse.json({ error: "Snapshot demo invalido." }, { status: 400 });
  }

  const demoUser = await getUsuarioById(body.demoUserId);
  if (!demoUser || !isDemoUser(demoUser.email)) {
    return NextResponse.json({ error: "Usuario demo invalido." }, { status: 400 });
  }

  const projetoNome = body.snapshot.projeto.nome?.trim() || "Meu Projeto";
  const supabase = getSupabaseAdminClient();
  const { data: existingProjeto } = await supabase
    .from("projetos")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("nome", projetoNome)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingProjeto?.id) {
    const { data: existingConsumo } = await supabase
      .from("consumos")
      .select("id")
      .eq("usuario_id", user.id)
      .eq("projeto_id", existingProjeto.id)
      .eq("origem", "demo_migrado")
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingConsumo?.id) {
      return NextResponse.json({ projetoId: existingProjeto.id }, { status: 200 });
    }
  }

  const projeto = await createProjetoForUsuario({
    usuarioId: user.id,
    nome: projetoNome,
    status: "ativo",
    modoCobranca: "plano",
  });

  if (!projeto) {
    return NextResponse.json({ error: "Nao foi possivel criar o projeto convertido." }, { status: 500 });
  }

  const projetoAtualizado = await updateProjeto({
    id: projeto.id,
    nome: projetoNome,
    slug: body.snapshot.projeto.slug,
    tipo: body.snapshot.projeto.tipo,
    descricao: body.snapshot.projeto.descricao,
    status: body.snapshot.projeto.status || "ativo",
    modeloId: body.snapshot.projeto.modeloId,
  });

  const projetoId = projetoAtualizado?.id ?? projeto.id;
  const apiIdMap = new Map<string, string>();

  for (const api of body.snapshot.apis ?? []) {
    const createdApi = await createApi({
      projetoId,
      nome: api.nome,
      url: api.url,
      metodo: api.metodo,
      descricao: api.descricao,
      ativo: api.ativo,
      campos: api.campos,
      parametros: api.parametros,
    });

    if (createdApi) {
      apiIdMap.set(api.id, createdApi.id);
    }
  }

  for (const agente of body.snapshot.agentes ?? []) {
    await createAgente({
      projetoId,
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      ativo: agente.ativo,
      apiIds: agente.apiIds.map((apiId) => apiIdMap.get(apiId)).filter((apiId): apiId is string => Boolean(apiId)),
    });
  }

  const { data: consumoData, error: consumoError } = await supabase
    .from("consumos")
    .select("tokens_input, tokens_output")
    .eq("usuario_id", body.demoUserId)
    .limit(5000);

  if (consumoError) {
    console.error("[auth/demo-convert] failed to sum demo usage", consumoError);
  } else {
    const rows = (consumoData ?? []) as Array<{ tokens_input?: number | null; tokens_output?: number | null }>;
    const totalInput = rows.reduce((sum, row) => sum + Number(row.tokens_input ?? 0), 0);
    const totalOutput = rows.reduce((sum, row) => sum + Number(row.tokens_output ?? 0), 0);

    if (totalInput > 0 || totalOutput > 0) {
      const { error: insertError } = await supabase.from("consumos").insert({
        usuario_id: user.id,
        projeto_id: projetoId,
        origem: "demo_migrado",
        tokens_input: totalInput,
        tokens_output: totalOutput,
        custo_total: 0,
        created_at: new Date().toISOString(),
      } as never);

      if (insertError) {
        console.error("[auth/demo-convert] failed to insert consolidated usage", insertError);
      }
    }
  }

  await setUsuarioAtivo(body.demoUserId, false);

  const refreshedUser = await getUsuarioById(user.id);
  if (refreshedUser) {
    await createSession(refreshedUser);
  }

  return NextResponse.json({ projetoId }, { status: 200 });
}
