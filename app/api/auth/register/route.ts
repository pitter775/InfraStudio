import { NextResponse } from "next/server";
import { registerUsuarioWithProjeto } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const { nome, email, senha, confirmarSenha } = (await request.json()) as {
      nome?: string;
      email?: string;
      senha?: string;
      confirmarSenha?: string;
    };

    if (!nome?.trim() || !email?.trim() || !senha || !confirmarSenha) {
      return NextResponse.json({ error: "Nome, email e senha sao obrigatorios." }, { status: 400 });
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json({ error: "A confirmacao de senha nao confere." }, { status: 400 });
    }

    if (senha.trim().length < 6) {
      return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
    }

    const result = await registerUsuarioWithProjeto({
      nome,
      email,
      senha,
    });

    if (!result.ok) {
      const status = result.reason === "email_already_exists" ? 409 : 500;
      const error =
        result.reason === "email_already_exists"
          ? "Ja existe uma conta com este email."
          : "Nao foi possivel concluir seu cadastro agora.";
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json(
      { message: "Enviamos um email para voce confirmar sua conta." },
      { status: 201 },
    );
  } catch (error) {
    console.error("[auth] register failed", error);
    return NextResponse.json({ error: "Nao foi possivel concluir seu cadastro agora." }, { status: 500 });
  }
}
