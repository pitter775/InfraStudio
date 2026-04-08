import { NextResponse } from "next/server";
import { loginOrCreateSocialUsuario } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const { provider, providerUserId, email, nome } = (await request.json()) as {
      provider?: "google" | "github" | "facebook";
      providerUserId?: string;
      email?: string;
      nome?: string;
    };

    if (!provider || !providerUserId?.trim() || !email?.trim() || !nome?.trim()) {
      return NextResponse.json({ error: "Dados do login social incompletos." }, { status: 400 });
    }

    const result = await loginOrCreateSocialUsuario({
      provider,
      providerUserId: providerUserId.trim(),
      email: email.trim(),
      nome: nome.trim(),
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Nao foi possivel concluir o login social." }, { status: 500 });
    }

    return NextResponse.json({ user: result.user }, { status: 200 });
  } catch (error) {
    console.error("[auth] social login failed", error);
    return NextResponse.json({ error: "Nao foi possivel concluir o login social." }, { status: 500 });
  }
}
