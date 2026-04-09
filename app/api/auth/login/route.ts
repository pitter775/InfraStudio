import { compareSync } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { findUsuarioWithPasswordByEmail, mapUsuarioToAppUser, touchUsuarioLogin } from "@/lib/usuarios";

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");

  if (!localPart) {
    return email;
  }

  const safeLocalPart =
    localPart.length <= 2 ? `${localPart[0] ?? "*"}*` : `${localPart.slice(0, 2)}***${localPart.slice(-1)}`;

  return domain ? `${safeLocalPart}@${domain}` : safeLocalPart;
}

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
    const rawEmail = email?.trim() ?? "";
    const normalizedEmail = rawEmail.toLowerCase();

    if (!rawEmail || !password) {
      console.warn("[auth] login rejected: missing credentials", {
        hasEmail: Boolean(rawEmail),
        hasPassword: Boolean(password),
      });
      return NextResponse.json({ error: "Email e senha sao obrigatorios." }, { status: 400 });
    }

    console.info("[auth] login attempt", {
      rawEmail: maskEmail(rawEmail),
      normalizedEmail: maskEmail(normalizedEmail),
    });

    const usuario = await findUsuarioWithPasswordByEmail(normalizedEmail);
    const passwordOk = usuario ? passwordMatches(password, usuario.senha) : false;

    if (!usuario || !passwordOk) {
      console.warn("[auth] login rejected: invalid credentials", {
        normalizedEmail: maskEmail(normalizedEmail),
        userFound: Boolean(usuario),
        userEmail: usuario?.email ? maskEmail(usuario.email) : null,
        passwordKind: usuario?.senha
          ? usuario.senha.startsWith("$2")
            ? "bcrypt"
            : "plaintext_or_other"
          : "missing",
      });
      return NextResponse.json({ error: "Email ou senha invalidos." }, { status: 401 });
    }

    if (usuario.email_verificado === false) {
      console.warn("[auth] login rejected: email not verified", {
        normalizedEmail: maskEmail(normalizedEmail),
        userId: usuario.id,
      });
      return NextResponse.json({ error: "Confirme seu email antes de acessar a plataforma." }, { status: 403 });
    }

    if (usuario.ativo === false) {
      console.warn("[auth] login rejected: inactive user", {
        normalizedEmail: maskEmail(normalizedEmail),
        userId: usuario.id,
      });
      return NextResponse.json({ error: "Usuario inativo." }, { status: 403 });
    }

    const appUser = mapUsuarioToAppUser(usuario);
    await createSession(appUser);
    await touchUsuarioLogin(usuario.id);
    console.info("[auth] login success", {
      normalizedEmail: maskEmail(normalizedEmail),
      userId: usuario.id,
      role: appUser.role,
    });

    return NextResponse.json({ user: appUser }, { status: 200 });
  } catch (error) {
    console.error("[auth] login failed", error);
    return NextResponse.json({ error: "Nao foi possivel autenticar agora." }, { status: 500 });
  }
}
