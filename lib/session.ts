import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AppUser } from "@/lib/app-user";

const SESSION_COOKIE = "infrastudio-session";

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AppUser["role"];
  status: AppUser["status"];
  isMaster?: boolean;
  currentProjectId?: string | null;
  memberships?: AppUser["memberships"];
};

function getSessionSecret() {
  const secret = process.env.APP_AUTH_SECRET;

  if (!secret) {
    throw new Error("APP_AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(user: AppUser) {
  const cookieStore = await cookies();
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    isMaster: user.isMaster,
    currentProjectId: user.currentProjectId ?? null,
    memberships: user.memberships ?? [],
  } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as AppUser["role"],
      status: payload.status as AppUser["status"],
      isMaster: Boolean(payload.isMaster),
      currentProjectId: typeof payload.currentProjectId === "string" ? payload.currentProjectId : null,
      memberships: Array.isArray(payload.memberships) ? (payload.memberships as AppUser["memberships"]) : [],
    } satisfies AppUser;
  } catch (error) {
    console.error("[session] failed to verify session", error);
    return null;
  }
}
