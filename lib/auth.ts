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
    });

    if (!response.ok) {
      console.error("[auth] failed to list users", payload.error);
      return [];
    }

    return payload.users;
  } catch (error) {
    console.error("[auth] failed to list users", error);
    return [];
  }
}
