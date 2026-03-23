import "server-only";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import {
  getConectorById,
  getMercadoLivreConnectorConfig,
  updateConector,
  type ConnectorRecord,
} from "@/lib/conectores";

const MERCADO_LIVRE_AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const MERCADO_LIVRE_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const MERCADO_LIVRE_USER_URL = "https://api.mercadolibre.com/users/me";
const OAUTH_COOKIE_NAME = "mercado_livre_oauth_state";

type MercadoLivreOAuthState = {
  state: string;
  connectorId: string;
  projetoId: string;
};

type MercadoLivreTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
};

type MercadoLivreUserResponse = {
  id?: number | string;
  nickname?: string;
};

function getMercadoLivreOAuthEnv() {
  return {
    appId: process.env.MERCADO_LIVRE_APP_ID?.trim() || process.env.MERCADO_LIVRE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() || "",
    redirectUri: process.env.MERCADO_LIVRE_REDIRECT_URI?.trim() || "",
  };
}

export function getMercadoLivreOAuthSetupStatus() {
  const env = getMercadoLivreOAuthEnv();

  return {
    ready: Boolean(env.appId && env.clientSecret && env.redirectUri),
    missing: [
      !env.appId ? "MERCADO_LIVRE_APP_ID" : null,
      !env.clientSecret ? "MERCADO_LIVRE_CLIENT_SECRET" : null,
      !env.redirectUri ? "MERCADO_LIVRE_REDIRECT_URI" : null,
    ].filter(Boolean) as string[],
  };
}

export async function buildMercadoLivreAuthorizationUrl(input: {
  connectorId: string;
  projetoId: string;
}) {
  const env = getMercadoLivreOAuthEnv();
  if (!env.appId || !env.clientSecret || !env.redirectUri) {
    throw new Error("Configure MERCADO_LIVRE_APP_ID, MERCADO_LIVRE_CLIENT_SECRET e MERCADO_LIVRE_REDIRECT_URI no servidor.");
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  const payload: MercadoLivreOAuthState = {
    state,
    connectorId: input.connectorId,
    projetoId: input.projetoId,
  };

  cookieStore.set(OAUTH_COOKIE_NAME, Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url"), {
    httpOnly: true,
    secure: env.redirectUri.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  const url = new URL(MERCADO_LIVRE_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.appId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "offline_access read");

  return url.toString();
}

async function exchangeCodeForTokens(code: string) {
  const env = getMercadoLivreOAuthEnv();
  if (!env.appId || !env.clientSecret || !env.redirectUri) {
    throw new Error("OAuth do Mercado Livre nao esta configurado no servidor.");
  }

  const response = await fetch(MERCADO_LIVRE_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.appId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: env.redirectUri,
    }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Mercado Livre retornou ${response.status} ao trocar o code por token. ${payload}`.trim());
  }

  return (await response.json()) as MercadoLivreTokenResponse;
}

async function refreshMercadoLivreTokens(refreshToken: string) {
  const env = getMercadoLivreOAuthEnv();
  if (!env.appId || !env.clientSecret) {
    throw new Error("OAuth do Mercado Livre nao esta configurado no servidor.");
  }

  const response = await fetch(MERCADO_LIVRE_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.appId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Mercado Livre retornou ${response.status} ao renovar o token. ${payload}`.trim());
  }

  return (await response.json()) as MercadoLivreTokenResponse;
}

async function fetchMercadoLivreUser(accessToken: string) {
  const response = await fetch(MERCADO_LIVRE_USER_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Mercado Livre retornou ${response.status} ao consultar o usuario autenticado.`);
  }

  return (await response.json()) as MercadoLivreUserResponse;
}

function buildTokenExpiry(expiresIn?: number) {
  const seconds = typeof expiresIn === "number" && Number.isFinite(expiresIn) ? expiresIn : 0;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function persistMercadoLivreTokens(connector: ConnectorRecord, tokenPayload: MercadoLivreTokenResponse) {
  const currentConfig = getMercadoLivreConnectorConfig(connector) ?? {};
  const accessToken = tokenPayload.access_token?.trim();
  const refreshToken = tokenPayload.refresh_token?.trim() || currentConfig.refresh_token;

  if (!accessToken) {
    throw new Error("Mercado Livre nao retornou access_token.");
  }

  const user = await fetchMercadoLivreUser(accessToken);
  const sellerId = String(user.id ?? tokenPayload.user_id ?? currentConfig.seller_id ?? "").trim();
  const nickname = user.nickname?.trim() || currentConfig.nickname;

  const updated = await updateConector({
    id: connector.id,
    projetoId: connector.projetoId ?? "",
    agenteId: connector.agenteId ?? null,
    nome: connector.nome,
    tipo: connector.tipo,
    endpointBase: connector.endpointBase,
    ativo: connector.ativo,
    configuracoes: {
      ...connector.configuracoes,
      seller_id: sellerId || currentConfig.seller_id,
      nickname,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: buildTokenExpiry(tokenPayload.expires_in),
      user_id: sellerId || currentConfig.user_id,
    },
  });

  if (!updated) {
    throw new Error("Nao foi possivel salvar o token do Mercado Livre no conector.");
  }

  return updated;
}

export async function completeMercadoLivreOAuthCallback(searchParams: URLSearchParams) {
  const code = searchParams.get("code")?.trim() || "";
  const state = searchParams.get("state")?.trim() || "";
  const error = searchParams.get("error")?.trim() || "";

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(OAUTH_COOKIE_NAME)?.value;
  cookieStore.delete(OAUTH_COOKIE_NAME);

  if (error) {
    throw new Error(`Mercado Livre recusou a autorizacao: ${error}.`);
  }

  if (!code || !state || !rawCookie) {
    throw new Error("Retorno do OAuth do Mercado Livre incompleto.");
  }

  const parsed = JSON.parse(Buffer.from(rawCookie, "base64url").toString("utf-8")) as MercadoLivreOAuthState;
  if (parsed.state !== state) {
    throw new Error("Estado do OAuth do Mercado Livre invalido.");
  }

  const connector = await getConectorById(parsed.connectorId);
  if (!connector || connector.projetoId !== parsed.projetoId) {
    throw new Error("Conector do Mercado Livre nao encontrado para concluir a autorizacao.");
  }

  const tokenPayload = await exchangeCodeForTokens(code);
  const updatedConnector = await persistMercadoLivreTokens(connector, tokenPayload);

  return {
    connector: updatedConnector,
    projetoId: parsed.projetoId,
  };
}

export async function ensureMercadoLivreAccessToken(connector: ConnectorRecord) {
  const config = getMercadoLivreConnectorConfig(connector);
  const accessToken = config?.access_token?.trim();
  const expiresAt = config?.token_expires_at ? Date.parse(config.token_expires_at) : 0;
  const refreshToken = config?.refresh_token?.trim();

  if (accessToken && expiresAt > Date.now() + 60_000) {
    return accessToken;
  }

  if (!refreshToken) {
    return accessToken || undefined;
  }

  const refreshed = await refreshMercadoLivreTokens(refreshToken);
  const updatedConnector = await persistMercadoLivreTokens(connector, refreshed);
  const updatedConfig = getMercadoLivreConnectorConfig(updatedConnector);
  return updatedConfig?.access_token?.trim() || undefined;
}
