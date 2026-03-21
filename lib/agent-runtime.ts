export type AgentRuntimeBlockKey = "core" | "qualification" | "pricing" | "handoff" | "whatsapp" | "notes";

export type AgentRuntimeConfig = {
  version: number;
  overview: {
    objetivo: string;
    descricao_curta?: string | null;
  };
  blocks: Record<AgentRuntimeBlockKey, string[]>;
  routes: Record<"greeting" | "default" | "pricing" | "whatsapp" | "api", AgentRuntimeBlockKey[]>;
};

const BLOCK_KEYS: AgentRuntimeBlockKey[] = ["core", "qualification", "pricing", "handoff", "whatsapp", "notes"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toCleanLines(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function normalizeAgentRuntimeConfig(value: unknown): AgentRuntimeConfig | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const overviewInput = isPlainObject(value.overview) ? value.overview : {};
  const blocksInput = isPlainObject(value.blocks) ? value.blocks : {};
  const routesInput = isPlainObject(value.routes) ? value.routes : {};
  const objetivo = typeof overviewInput.objetivo === "string" ? overviewInput.objetivo.trim() : "";

  if (!objetivo) {
    return null;
  }

  const blocks = Object.fromEntries(
    BLOCK_KEYS.map((key) => [key, toCleanLines(blocksInput[key])]),
  ) as Record<AgentRuntimeBlockKey, string[]>;

  const toRoute = (routeKey: "greeting" | "default" | "pricing" | "whatsapp" | "api", fallback: AgentRuntimeBlockKey[]) => {
    const raw = routesInput[routeKey];
    if (!Array.isArray(raw)) {
      return fallback;
    }

    const items = raw.filter((item): item is AgentRuntimeBlockKey => typeof item === "string" && BLOCK_KEYS.includes(item as AgentRuntimeBlockKey));
    return items.length ? items : fallback;
  };

  return {
    version: typeof value.version === "number" ? value.version : 1,
    overview: {
      objetivo,
      descricao_curta: typeof overviewInput.descricao_curta === "string" ? overviewInput.descricao_curta.trim() : null,
    },
    blocks,
    routes: {
      greeting: toRoute("greeting", ["core"]),
      default: toRoute("default", ["core", "qualification"]),
      pricing: toRoute("pricing", ["core", "pricing", "qualification"]),
      whatsapp: toRoute("whatsapp", ["core", "whatsapp", "handoff"]),
      api: toRoute("api", ["core", "qualification"]),
    },
  };
}

export function getAgentRuntimeBlockEntries(runtime: AgentRuntimeConfig) {
  return BLOCK_KEYS.map((key) => ({
    key,
    lines: runtime.blocks[key],
  })).filter((entry) => entry.lines.length > 0);
}

export function selectAgentRuntimeLines(runtime: AgentRuntimeConfig, blockKeys: AgentRuntimeBlockKey[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const key of blockKeys) {
    for (const line of runtime.blocks[key] ?? []) {
      if (!seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
  }

  return lines;
}
