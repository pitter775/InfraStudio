import { NextResponse } from "next/server";
import { resendUsuarioVerificationEmail } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email e obrigatorio." }, { status: 400 });
    }

    const result = await resendUsuarioVerificationEmail(email);

    if (!result.ok) {
      const status =
        result.reason === "user_not_found" ? 404 : result.reason === "already_verified" ? 409 : 500;
      const error =
        result.reason === "user_not_found"
          ? "Nao encontramos uma conta com este email."
          : result.reason === "already_verified"
            ? "Este email ja foi confirmado."
            : "Nao foi possivel reenviar o email agora.";

      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({ message: "Enviamos um novo email de confirmacao." }, { status: 200 });
  } catch (error) {
    console.error("[auth] resend verification failed", error);
    return NextResponse.json({ error: "Nao foi possivel reenviar o email agora." }, { status: 500 });
  }
}
