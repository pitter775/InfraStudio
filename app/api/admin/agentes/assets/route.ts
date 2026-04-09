import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessGlobalAdmin, canManageProject, resolveCurrentProjectId } from "@/lib/access";
import { createAgenteAsset, deleteAgenteAsset, getAgenteAssetById } from "@/lib/agente-assets";
import { getAgenteById } from "@/lib/agentes";
import { canDemoUserEditProject, isDemoProjectMutationBlocked } from "@/lib/demo-project-guard";
import { getSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const formData = await request.formData();
  const agenteId = String(formData.get("agenteId") || "").trim();
  const projetoIdFromBody = String(formData.get("projetoId") || "").trim() || null;
  const nome = String(formData.get("nome") || "").trim() || null;
  const descricao = String(formData.get("descricao") || "").trim() || null;
  const file = formData.get("file");

  if (!agenteId) {
    return NextResponse.json({ error: "Agente obrigatorio." }, { status: 400 });
  }

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Arquivo obrigatorio." }, { status: 400 });
  }

  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "O arquivo excede o limite de 15 MB." }, { status: 400 });
  }

  const agente = await getAgenteById(agenteId);
  const projetoId = canAccessGlobalAdmin(user) ? projetoIdFromBody ?? agente?.projetoId ?? null : resolveCurrentProjectId(user);

  const canEditProjeto = projetoId
    ? canManageProject(user, projetoId) || await canDemoUserEditProject(user?.email, projetoId)
    : false;
  if (!agente || !projetoId || agente.projetoId !== projetoId || !canEditProjeto) {
    return NextResponse.json({ error: "Agente ou projeto invalido para upload." }, { status: 403 });
  }

  const asset = await createAgenteAsset({
    agenteId,
    projetoId,
    nome,
    descricao,
    file,
  });

  if (!asset) {
    return NextResponse.json({ error: "Nao foi possivel salvar o arquivo do agente." }, { status: 500 });
  }

  return NextResponse.json({ asset }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Id do arquivo obrigatorio." }, { status: 400 });
  }

  const asset = await getAgenteAssetById(body.id);
  if (!asset) {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 });
  }

  if (!canManageProject(user, asset.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para este projeto." }, { status: 403 });
  }

  const deleted = await deleteAgenteAsset(body.id);
  if (!deleted) {
    return NextResponse.json({ error: "Nao foi possivel remover o arquivo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
