import { compareSync } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { findUsuarioWithPasswordByEmail, mapUsuarioToAppUser, touchUsuarioLogin } from "@/lib/usuarios";

function passwordMatches(inputPassword: string, storedPassword: string | null) {
  if (!storedPassword) {
    return false;
  }

  if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
    return compareSync(inputPassword, storedPassword);
  }

  if (storedPassword === inputPassword) {
    console.warn("[auth] usuario with plaintext password detected; migrate this record to bcrypt.");
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha sao obrigatorios." }, { status: 400 });
    }

    const usuario = await findUsuarioWithPasswordByEmail(email.trim().toLowerCase());

    if (!usuario || !passwordMatches(password, usuario.senha)) {
      return NextResponse.json({ error: "Email ou senha invalidos." }, { status: 401 });
    }

    if (usuario.ativo === false) {
      return NextResponse.json({ error: "Usuario inativo." }, { status: 403 });
    }

    const appUser = mapUsuarioToAppUser(usuario);
    await createSession(appUser);
    await touchUsuarioLogin(usuario.id);

    return NextResponse.json({ user: appUser }, { status: 200 });
  } catch (error) {
    console.error("[auth] login failed", error);
    return NextResponse.json({ error: "Nao foi possivel autenticar agora." }, { status: 500 });
  }
}
