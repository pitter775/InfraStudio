import "server-only";

import { SignJWT, jwtVerify } from "jose";

type HandoffAccessPayload = {
  projetoId: string;
  chatId: string;
  canalWhatsappId?: string | null;
  handoffContactId?: string | null;
};

function getHandoffLinkSecret() {
  const secret = process.env.HANDOFF_LINK_SECRET?.trim() || process.env.APP_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("HANDOFF_LINK_SECRET ou APP_AUTH_SECRET precisa estar configurado para gerar links de handoff.");
  }

  return new TextEncoder().encode(secret);
}

function getAppBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://infrastudio.pro"
  ).replace(/\/$/, "");
}

export async function createHandoffAccessToken(input: HandoffAccessPayload) {
  return await new SignJWT({
    projetoId: input.projetoId,
    chatId: input.chatId,
    canalWhatsappId: input.canalWhatsappId ?? null,
    handoffContactId: input.handoffContactId ?? null,
  } satisfies HandoffAccessPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getHandoffLinkSecret());
}

export async function createHandoffAccessLink(input: HandoffAccessPayload) {
  const token = await createHandoffAccessToken(input);
  return `${getAppBaseUrl()}/handoff/${encodeURIComponent(token)}`;
}

export async function verifyHandoffAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getHandoffLinkSecret());

  return {
    projetoId: String(payload.projetoId || ""),
    chatId: String(payload.chatId || ""),
    canalWhatsappId:
      typeof payload.canalWhatsappId === "string" && payload.canalWhatsappId.trim()
        ? payload.canalWhatsappId.trim()
        : null,
    handoffContactId:
      typeof payload.handoffContactId === "string" && payload.handoffContactId.trim()
        ? payload.handoffContactId.trim()
        : null,
  } satisfies HandoffAccessPayload;
}
