import "server-only";

export const DEMO_TTL_MINUTES = 30;
export const DEMO_WARNING_MINUTES = 5;

export type DemoProjectStatus = "ativo" | "expirado" | "convertido" | "descartado";
export type DemoProjectMode = "demo" | "real";

export type DemoProjectMetadata = {
  modo: DemoProjectMode;
  isDemo: boolean;
  demoExpiresAt: string | null;
  demoStatus: DemoProjectStatus | null;
  demoOwnerUserId: string | null;
  demoTemplateSourceId: string | null;
  isDemoTemplateSource: boolean;
};

export type DemoChannelMetadata = {
  sessionId: string | null;
  modo: DemoProjectMode;
  expiraEm: string | null;
  reconnectDisabled: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStatus(value: unknown): DemoProjectStatus | null {
  return value === "ativo" || value === "expirado" || value === "convertido" || value === "descartado"
    ? value
    : null;
}

function normalizeMode(value: unknown): DemoProjectMode {
  return value === "demo" ? "demo" : "real";
}

export function buildDemoExpirationDate(baseDate = new Date(), ttlMinutes = DEMO_TTL_MINUTES) {
  return new Date(baseDate.getTime() + ttlMinutes * 60_000).toISOString();
}

export function getDemoProjectMetadata(configuracoes: Record<string, unknown> | null | undefined, isDemoFlag = false): DemoProjectMetadata {
  const demo = isRecord(configuracoes?.demo) ? configuracoes.demo : {};

  return {
    modo: normalizeMode(demo.modo),
    isDemo: isDemoFlag || demo.is_demo === true || demo.modo === "demo",
    demoExpiresAt: normalizeTimestamp(demo.demo_expires_at),
    demoStatus: normalizeStatus(demo.demo_status),
    demoOwnerUserId: typeof demo.demo_owner_user_id === "string" && demo.demo_owner_user_id.trim() ? demo.demo_owner_user_id.trim() : null,
    demoTemplateSourceId:
      typeof demo.demo_template_source_id === "string" && demo.demo_template_source_id.trim()
        ? demo.demo_template_source_id.trim()
        : null,
    isDemoTemplateSource: demo.demo_template_source === true,
  };
}

export function withDemoProjectMetadata(
  configuracoes: Record<string, unknown> | null | undefined,
  metadata: Partial<DemoProjectMetadata>,
) {
  const current = getDemoProjectMetadata(configuracoes, metadata.isDemo === true);

  return {
    ...(configuracoes ?? {}),
    demo: {
      is_demo: metadata.isDemo ?? current.isDemo,
      modo: metadata.modo ?? current.modo,
      demo_expires_at: metadata.demoExpiresAt ?? current.demoExpiresAt,
      demo_status: metadata.demoStatus ?? current.demoStatus,
      demo_owner_user_id: metadata.demoOwnerUserId ?? current.demoOwnerUserId,
      demo_template_source_id: metadata.demoTemplateSourceId ?? current.demoTemplateSourceId,
      demo_template_source: metadata.isDemoTemplateSource ?? current.isDemoTemplateSource,
    },
  };
}

export function isDemoProjectExpired(input: {
  isDemo?: boolean | null;
  demoExpiresAt?: string | null;
  demoStatus?: DemoProjectStatus | null;
}) {
  if (!input.isDemo) {
    return false;
  }

  if (input.demoStatus === "expirado" || input.demoStatus === "descartado" || input.demoStatus === "convertido") {
    return true;
  }

  if (!input.demoExpiresAt) {
    return false;
  }

  return new Date(input.demoExpiresAt).getTime() <= Date.now();
}

export function getDemoRemainingMs(input: {
  isDemo?: boolean | null;
  demoExpiresAt?: string | null;
  demoStatus?: DemoProjectStatus | null;
}) {
  if (!input.isDemo || !input.demoExpiresAt || isDemoProjectExpired(input)) {
    return 0;
  }

  return Math.max(new Date(input.demoExpiresAt).getTime() - Date.now(), 0);
}

export function shouldWarnDemoExpiration(input: {
  isDemo?: boolean | null;
  demoExpiresAt?: string | null;
  demoStatus?: DemoProjectStatus | null;
}) {
  return getDemoRemainingMs(input) <= DEMO_WARNING_MINUTES * 60_000;
}

export function getDemoChannelMetadata(sessionData: Record<string, unknown> | null | undefined): DemoChannelMetadata {
  const demo = isRecord(sessionData?.demo) ? sessionData.demo : {};

  return {
    sessionId: typeof demo.session_id === "string" && demo.session_id.trim() ? demo.session_id.trim() : null,
    modo: normalizeMode(demo.modo),
    expiraEm: normalizeTimestamp(demo.expira_em),
    reconnectDisabled: demo.reconnect_disabled === true,
  };
}

export function withDemoChannelMetadata(
  sessionData: Record<string, unknown> | null | undefined,
  metadata: Partial<DemoChannelMetadata>,
) {
  const current = getDemoChannelMetadata(sessionData);

  return {
    ...(sessionData ?? {}),
    demo: {
      session_id: metadata.sessionId ?? current.sessionId,
      modo: metadata.modo ?? current.modo,
      expira_em: metadata.expiraEm ?? current.expiraEm,
      reconnect_disabled: metadata.reconnectDisabled ?? current.reconnectDisabled,
    },
  };
}

export function isDemoChannelExpired(sessionData: Record<string, unknown> | null | undefined) {
  const metadata = getDemoChannelMetadata(sessionData);
  if (metadata.modo !== "demo" || !metadata.expiraEm) {
    return false;
  }

  return new Date(metadata.expiraEm).getTime() <= Date.now();
}

export function sanitizeConnectorConfigForDemo(configuracoes: Record<string, unknown> | null | undefined) {
  if (!configuracoes) {
    return null;
  }

  const next = { ...configuracoes };
  delete next.access_token;
  delete next.refresh_token;
  delete next.client_secret;
  return next;
}
