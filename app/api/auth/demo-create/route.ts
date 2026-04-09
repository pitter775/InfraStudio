import { NextResponse } from "next/server";
import { createOrReuseDemoProjectForUser } from "@/lib/demo-project-service";
import { isDemoUser } from "@/lib/demo-user";
import { createSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createUsuario, findUsuarioWithPasswordByEmail, getUsuarioById } from "@/lib/usuarios";

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

    let demoUser = await findUsuarioWithPasswordByEmail(normalizedEmail);
    if (!demoUser) {
      const created = await createUsuario({
        nome: "Usuario Demonstracao",
        email: normalizedEmail,
        senha: password,
        ativo: true,
        papel: "viewer",
        provider: "email",
        emailVerificado: true,
        projetoIds: [],
      });

      if (!created) {
        return NextResponse.json({ error: "Nao foi possivel criar o usuario demo." }, { status: 500 });
      }

      demoUser = await findUsuarioWithPasswordByEmail(normalizedEmail);
    }

    if (!demoUser) {
      return NextResponse.json({ error: "Nao foi possivel preparar o usuario demo." }, { status: 500 });
    }

    const projeto = await createOrReuseDemoProjectForUser(demoUser.id);
    if (!projeto) {
      return NextResponse.json({ error: "Projeto demo nao configurado." }, { status: 500 });
    }

    await getSupabaseAdminClient()
      .from("usuarios")
      .update({
        ultimo_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", demoUser.id);

    const refreshedUser = await getUsuarioById(demoUser.id);
    if (refreshedUser) {
      await createSession(refreshedUser);
    }

    return NextResponse.json(
      {
        ok: true,
        projectId: projeto.id,
        demo: {
          expiresAt: projeto.demoExpiresAt,
          status: projeto.demoStatus,
          remainingMs: projeto.demoRemainingMs,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[auth] demo-create failed", error);
    return NextResponse.json({ error: "Nao foi possivel criar o usuario demo." }, { status: 500 });
  }
}
