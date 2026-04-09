import { NextResponse } from "next/server";
import { getDemoProjeto } from "@/lib/projetos";
import { createSession } from "@/lib/session";
import { createUsuario, findUsuarioWithPasswordByEmail } from "@/lib/usuarios";
import { getUsuarioById } from "@/lib/usuarios";
import { isDemoUser } from "@/lib/demo-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

async function syncDemoProjectMembership(usuarioId: string, projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("usuarios_projetos")
    .delete()
    .eq("usuario_id", usuarioId)
    .neq("projeto_id", projetoId);

  if (deleteError) {
    console.error("[auth] failed to prune demo project memberships", deleteError);
    return false;
  }

  const { data: existing, error: readError } = await supabase
    .from("usuarios_projetos")
    .select("usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("projeto_id", projetoId)
    .maybeSingle();

  if (readError) {
    console.error("[auth] failed to read demo project membership", readError);
    return false;
  }

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("usuarios_projetos").insert({
    usuario_id: usuarioId,
    projeto_id: projetoId,
    papel: "viewer",
    created_at: new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[auth] failed to ensure demo project membership", error);
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const { email, senha } = (await request.json()) as { email?: string; senha?: string };
    const normalizedEmail = email?.trim().toLowerCase() ?? "";
    const password = senha?.trim() ?? "";

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email e senha sao obrigatorios." }, { status: 400 });
    }

    if (!isDemoUser(normalizedEmail)) {
      return NextResponse.json({ error: "Email de demonstracao invalido." }, { status: 400 });
    }

    const demoProjeto = await getDemoProjeto();
    if (!demoProjeto) {
      return NextResponse.json({ error: "Projeto demo nao configurado." }, { status: 500 });
    }

    const existing = await findUsuarioWithPasswordByEmail(normalizedEmail);
    if (existing) {
      const membershipEnsured = await syncDemoProjectMembership(existing.id, demoProjeto.id);
      if (!membershipEnsured) {
        return NextResponse.json({ error: "Nao foi possivel vincular o usuario demo ao projeto." }, { status: 500 });
      }

      const refreshedUser = await getUsuarioById(existing.id);
      if (refreshedUser) {
        await createSession(refreshedUser);
      }

      return NextResponse.json({ ok: true, existed: true, projectId: demoProjeto.id }, { status: 200 });
    }

    const created = await createUsuario({
      nome: "Usuario Demonstracao",
      email: normalizedEmail,
      senha: password,
      ativo: true,
      papel: "viewer",
      provider: "email",
      emailVerificado: true,
      projetoIds: [demoProjeto.id],
    });

    if (!created) {
      return NextResponse.json({ error: "Nao foi possivel criar o usuario demo." }, { status: 500 });
    }

    const membershipEnsured = await syncDemoProjectMembership(created.id, demoProjeto.id);
    if (!membershipEnsured) {
      return NextResponse.json({ error: "Nao foi possivel vincular o usuario demo ao projeto." }, { status: 500 });
    }

    const refreshedUser = await getUsuarioById(created.id);
    if (refreshedUser) {
      await createSession(refreshedUser);
    }

    return NextResponse.json({ ok: true, existed: false, projectId: demoProjeto.id, user: created }, { status: 201 });
  } catch (error) {
    console.error("[auth] demo-create failed", error);
    return NextResponse.json({ error: "Nao foi possivel criar o usuario demo." }, { status: 500 });
  }
}
