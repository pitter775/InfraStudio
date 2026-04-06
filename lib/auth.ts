import type { AppUser } from "@/lib/app-user";
import { applyAccessProfile } from "@/lib/access";
import { mockUsers } from "@/lib/mock-users";

const SESSION_KEY = "infrastudio-auth-user";

type AuthResult = {
  error: string | null;
  mode: "mock" | "custom";
  user: AppUser | null;
};

function getMockUserByCredentials(email: string, password: string): AppUser | null {
  const mockUser = mockUsers.find((item) => item.email === email && item.password === password);

  if (!mockUser) {
    return null;
  }

  return applyAccessProfile({
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    role: mockUser.role,
    status: mockUser.status,
  });
}

function saveMockSession(user: AppUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getMockSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUser = window.localStorage.getItem(SESSION_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AppUser;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearMockSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as T;

  return { response, payload };
}

function isCustomAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.APP_AUTH_SECRET);
}

export function getAuthProviderLabel() {
  return isCustomAuthConfigured() ? "custom" : "mock";
}

export async function signInWithProjectAuth(email: string, password: string): Promise<AuthResult> {
  if (!isCustomAuthConfigured()) {
    const mockUser = getMockUserByCredentials(email, password);

    if (mockUser) {
      saveMockSession(mockUser);
    }

    return {
      mode: "mock",
      user: mockUser,
      error: mockUser ? null : "Email ou senha inválidos.",
    };
  }

  clearMockSession();

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
        error: payload.error ?? "Não foi possível autenticar agora.",
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
      error: "Não foi possível autenticar agora.",
    };
  }
}

export async function getCurrentProjectUser() {
  if (!isCustomAuthConfigured()) {
    return getMockSession();
  }

  try {
    const { payload } = await requestJson<{ user: AppUser | null }>("/api/auth/me", { method: "GET" });
    return payload.user;
  } catch (error) {
    console.error("[auth] failed to load current user", error);
    return null;
  }
}

export async function signOutProjectAuth() {
  if (!isCustomAuthConfigured()) {
    clearMockSession();
    return;
  }

  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("[auth] logout request failed", error);
  }

  clearMockSession();
}

export async function listProjectUsers() {
  if (!isCustomAuthConfigured()) {
    return mockUsers.map<AppUser>((user) =>
      applyAccessProfile({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }),
    );
  }

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
