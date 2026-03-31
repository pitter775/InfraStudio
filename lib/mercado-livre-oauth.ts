import "server-only";

import { createHash, randomBytes, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { appendSystemLog } from "@/lib/chat-logs";
import {
  getConectorById,
  getMercadoLivreConnectorConfig,
  updateConector,
  type ConnectorRecord,
} from "@/lib/conectores";

const MERCADO_LIVRE_AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const MERCADO_LIVRE_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const MERCADO_LIVRE_USER_URL = "https://api.mercadolibre.com/users/me";

type MercadoLivreOAuthState = {
  nonce: string;
  connectorId: string;
  projetoId: string;
  codeVerifier: string;
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

type MercadoLivreOAuthCredentials = {
  appId: string;
  clientSecret: string;
  redirectUri: string;
};

function getMercadoLivreOAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("APP_AUTH_SECRET nao esta configurado para assinar o OAuth do Mercado Livre.");
  }

  return new TextEncoder().encode(secret);
}

async function signMercadoLivreOAuthState(payload: MercadoLivreOAuthState) {
  return new SignJWT({
    connectorId: payload.connectorId,
    projetoId: payload.projetoId,
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getMercadoLivreOAuthSecret());
}

async function verifyMercadoLivreOAuthState(token: string) {
  const { payload } = await jwtVerify(token, getMercadoLivreOAuthSecret());

  return {
    connectorId: String(payload.connectorId ?? "").trim(),
    projetoId: String(payload.projetoId ?? "").trim(),
    nonce: String(payload.nonce ?? "").trim(),
    codeVerifier: String(payload.codeVerifier ?? "").trim(),
  } satisfies MercadoLivreOAuthState;
}

function buildMercadoLivreCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

function buildMercadoLivreCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function normalizeBaseUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/$/, "") || "";
}

function buildMercadoLivreRedirectUri(origin?: string | null) {
  const envRedirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI?.trim() || "";
  if (envRedirectUri) {
    return envRedirectUri;
  }

  const normalizedOrigin = normalizeBaseUrl(origin);
  if (!normalizedOrigin) {
    return "";
  }

  return `${normalizedOrigin}/api/admin/conectores/mercado-livre/callback`;
}

function getMercadoLivreOAuthEnv() {
  return {
    appId: process.env.MERCADO_LIVRE_APP_ID?.trim() || process.env.MERCADO_LIVRE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() || "",
  };
}

function getMercadoLivreOAuthCredentials(
  connector?: Pick<ConnectorRecord, "tipo" | "configuracoes"> | null,
  origin?: string | null,
): MercadoLivreOAuthCredentials {
  const env = getMercadoLivreOAuthEnv();
  const config = connector ? getMercadoLivreConnectorConfig(connector) : null;

  return {
    appId: config?.app_id?.trim() || env.appId,
    clientSecret: config?.client_secret?.trim() || env.clientSecret,
    redirectUri: buildMercadoLivreRedirectUri(origin),
  };
}

export function getMercadoLivreOAuthSetupStatus(
  connector?: Pick<ConnectorRecord, "tipo" | "configuracoes"> | null,
  origin?: string | null,
) {
  const credentials = getMercadoLivreOAuthCredentials(connector, origin);

  return {
    ready: Boolean(credentials.appId && credentials.clientSecret && credentials.redirectUri),
    missing: [
      !credentials.appId ? "APP ID do conector ou MERCADO_LIVRE_APP_ID" : null,
      !credentials.clientSecret ? "CLIENT SECRET do conector ou MERCADO_LIVRE_CLIENT_SECRET" : null,
      !credentials.redirectUri ? "URL base publica da aplicacao ou MERCADO_LIVRE_REDIRECT_URI" : null,
    ].filter(Boolean) as string[],
  };
}

export async function buildMercadoLivreAuthorizationUrl(input: {
  connector: ConnectorRecord;
  origin?: string | null;
}) {
  const credentials = getMercadoLivreOAuthCredentials(input.connector, input.origin);
  if (!credentials.appId || !credentials.clientSecret || !credentials.redirectUri) {
    throw new Error("Preencha APP ID, CLIENT SECRET no conector e garanta que a aplicacao tenha uma URL publica valida para a callback do Mercado Livre.");
  }

  const payload: MercadoLivreOAuthState = {
    nonce: randomUUID(),
    connectorId: input.connector.id,
    projetoId: input.connector.projetoId ?? "",
    codeVerifier: buildMercadoLivreCodeVerifier(),
  };
  const state = await signMercadoLivreOAuthState(payload);

  const url = new URL(MERCADO_LIVRE_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", credentials.appId);
  url.searchParams.set("redirect_uri", credentials.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "offline_access read");
  url.searchParams.set("code_challenge", buildMercadoLivreCodeChallenge(payload.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  connector: ConnectorRecord,
  origin?: string | null,
) {
  const credentials = getMercadoLivreOAuthCredentials(connector, origin);
  if (!credentials.appId || !credentials.clientSecret || !credentials.redirectUri) {
    throw new Error("OAuth do Mercado Livre nao esta configurado no servidor.");
  }

  await appendSystemLog({
    projetoId: connector.projetoId ?? null,
    tipo: "mercado_livre_oauth_exchange_start",
    origem: "mercado_livre_oauth",
    descricao: "Iniciando troca do code por token no Mercado Livre.",
    payload: {
      connectorId: connector.id,
      connectorName: connector.nome,
      redirectUri: credentials.redirectUri,
      hasCode: Boolean(code),
      hasCodeVerifier: Boolean(codeVerifier),
      hasAppId: Boolean(credentials.appId),
      hasClientSecret: Boolean(credentials.clientSecret),
    },
  });

  const response = await fetch(MERCADO_LIVRE_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: credentials.appId,
      client_secret: credentials.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: credentials.redirectUri,
    }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    await appendSystemLog({
      projetoId: connector.projetoId ?? null,
      tipo: "mercado_livre_oauth_exchange_error",
      origem: "mercado_livre_oauth",
      descricao: "Mercado Livre recusou a troca do code por token.",
      payload: {
        connectorId: connector.id,
        connectorName: connector.nome,
        status: response.status,
        responseText: payload || null,
        redirectUri: credentials.redirectUri,
        hasCodeVerifier: Boolean(codeVerifier),
      },
    });
    throw new Error(`Mercado Livre retornou ${response.status} ao trocar o code por token. ${payload}`.trim());
  }

  const tokenPayload = (await response.json()) as MercadoLivreTokenResponse;
  await appendSystemLog({
    projetoId: connector.projetoId ?? null,
    tipo: "mercado_livre_oauth_exchange_success",
    origem: "mercado_livre_oauth",
    descricao: "Mercado Livre retornou tokens para o conector.",
    payload: {
      connectorId: connector.id,
      connectorName: connector.nome,
      hasAccessToken: Boolean(tokenPayload.access_token),
      hasRefreshToken: Boolean(tokenPayload.refresh_token),
      hasUserId: Boolean(tokenPayload.user_id),
      expiresIn: tokenPayload.expires_in ?? null,
    },
  });

  return tokenPayload;
}

async function refreshMercadoLivreTokens(refreshToken: string, connector: ConnectorRecord) {
  const credentials = getMercadoLivreOAuthCredentials(connector);
  if (!credentials.appId || !credentials.clientSecret) {
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
      client_id: credentials.appId,
      client_secret: credentials.clientSecret,
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
      app_id: currentConfig.app_id,
      client_secret: currentConfig.client_secret,
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

export async function completeMercadoLivreOAuthCallback(searchParams: URLSearchParams, origin?: string | null) {
  const code = searchParams.get("code")?.trim() || "";
  const state = searchParams.get("state")?.trim() || "";
  const error = searchParams.get("error")?.trim() || "";

  if (error) {
    throw new Error(`Mercado Livre recusou a autorizacao: ${error}.`);
  }

  if (!code || !state) {
    throw new Error("Retorno do OAuth do Mercado Livre incompleto.");
  }

  const parsed = await verifyMercadoLivreOAuthState(state);

  const connector = await getConectorById(parsed.connectorId);
  if (!connector || connector.projetoId !== parsed.projetoId) {
    throw new Error("Conector do Mercado Livre nao encontrado para concluir a autorizacao.");
  }

  const tokenPayload = await exchangeCodeForTokens(code, parsed.codeVerifier, connector, origin);
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

  const refreshed = await refreshMercadoLivreTokens(refreshToken, connector);
  const updatedConnector = await persistMercadoLivreTokens(connector, refreshed);
  const updatedConfig = getMercadoLivreConnectorConfig(updatedConnector);
  return updatedConfig?.access_token?.trim() || undefined;
}
