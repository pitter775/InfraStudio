import { SignJWT, jwtVerify } from "jose";
import type { AppUser } from "@/lib/app-user";

export const SESSION_COOKIE = "infrastudio-session";

export type SessionPayload = {
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

export async function signSessionToken(user: AppUser) {
  return new SignJWT({
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
}

export async function verifySessionToken(token: string) {
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
}
