import { NextResponse } from "next/server";
import { debugFindUsuarioByEmail, findUsuarioWithPasswordByEmail } from "@/lib/usuarios";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase() ?? "";

    if (!email) {
      return NextResponse.json(
        {
          ok: true,
          configured: {
            url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
            serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
            authSecret: Boolean(process.env.APP_AUTH_SECRET),
          },
          hint: "Passe ?email=adm@adm para validar um usuário específico.",
        },
        { status: 200 },
      );
    }

    const usuario = await findUsuarioWithPasswordByEmail(email);
    const debug = await debugFindUsuarioByEmail(email);

    return NextResponse.json(
      {
        ok: true,
        projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        configured: {
          url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          authSecret: Boolean(process.env.APP_AUTH_SECRET),
        },
        debug: {
          error: debug.error
            ? {
                message: debug.error.message,
                details: debug.error.details,
                hint: debug.error.hint,
                code: debug.error.code,
              }
            : null,
          rowCount: debug.data ? 1 : 0,
        },
        lookup: {
          email,
          found: Boolean(usuario),
          ativo: usuario?.ativo ?? null,
          hasPassword: Boolean(usuario?.senha),
          passwordLooksHashed: Boolean(usuario?.senha?.startsWith("$2")),
          isAdmin: Boolean(
            usuario?.usuarios_projetos?.some((membership) => (membership.papel ?? "").trim().toLowerCase() === "admin"),
          ),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[health] db check failed", error);
    return NextResponse.json({ ok: false, error: "Falha ao validar a conexão com o banco." }, { status: 500 });
  }
}
