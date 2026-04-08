import type { AppUser } from "@/lib/app-user";

type AuthResult = {
  error: string | null;
  mode: "custom";
  user: AppUser | null;
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as T;

  return { response, payload };
}

export async function signInWithProjectAuth(email: string, password: string): Promise<AuthResult> {
  try {
    const { response, payload } = await requestJson<{ error?: string; user: AppUser | null }>("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return {
        mode: "custom",
        user: null,
        error: payload.error ?? "Nao foi possivel autenticar agora.",
      };
    }

    return {
      mode: "custom",
      user: payload.user,
      error: null,
    };
  } catch (error) {
    console.error("[auth] login request failed", error);

    return {
      mode: "custom",
      user: null,
      error: "Nao foi possivel autenticar agora.",
    };
  }
}

export async function registerWithProjectAuth(input: {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
}) {
  try {
    const { response, payload } = await requestJson<{ error?: string; message?: string }>("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return {
      ok: response.ok,
      error: response.ok ? null : payload.error ?? "Nao foi possivel concluir seu cadastro agora.",
      message: payload.message ?? null,
    };
  } catch (error) {
    console.error("[auth] register request failed", error);
    return {
      ok: false,
      error: "Nao foi possivel concluir seu cadastro agora.",
      message: null,
    };
  }
}

export async function signInWithSocialProvider(provider: "google" | "github" | "facebook") {
  window.location.href = `/api/auth/oauth/start?provider=${provider}`;
  return { ok: true as const, error: null };
}

export async function resendVerificationEmail(email: string) {
  try {
    const { response, payload } = await requestJson<{ error?: string; message?: string }>("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    return {
      ok: response.ok,
      error: response.ok ? null : payload.error ?? "Nao foi possivel reenviar o email agora.",
      message: payload.message ?? null,
    };
  } catch (error) {
    console.error("[auth] resend verification request failed", error);
    return {
      ok: false,
      error: "Nao foi possivel reenviar o email agora.",
      message: null,
    };
  }
}

export async function getCurrentProjectUser() {
  try {
    const { payload } = await requestJson<{ user: AppUser | null }>("/api/auth/me", {
      method: "GET",
      cache: "no-store",
    });
    return payload.user;
  } catch (error) {
    console.error("[auth] failed to load current user", error);
    return null;
  }
}

export async function signOutProjectAuth() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("[auth] logout request failed", error);
  }
}

export async function listProjectUsers() {
  try {
    const { response, payload } = await requestJson<{ error?: string; users: AppUser[] }>("/api/admin/usuarios", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const message = payload.error ?? "Nao foi possivel carregar os usuarios.";
      console.error("[auth] failed to list users", message);
      throw new Error(message);
    }

    return {
      users: payload.users,
      error: null,
    };
  } catch (error) {
    console.error("[auth] failed to list users", error);
    return {
      users: [],
      error: error instanceof Error ? error.message : "Nao foi possivel carregar os usuarios.",
    };
  }
}
