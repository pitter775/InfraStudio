import "server-only";

import type { ApiRuntimeContext } from "@/lib/apis";

type ScoredApiField = ApiRuntimeContext["campos"][number] & {
  apiNome: string;
  score: number;
};

type ApiRuntimeDeps = {
  normalizeText: (value: string) => string;
  buildSearchTokens: (message: string) => string[];
  singularizeToken: (token: string) => string;
};

const API_FIELD_INTENTS = [
  {
    triggers: ["problema", "problemas", "risco", "riscos", "alerta", "alertas", "atencao", "atencoes", "impedimento", "impedimentos", "pendencia", "pendencias", "restricao", "restricoes"],
    targets: ["riscos", "risco", "observacoes_juridicas", "ocupacao", "cartorio", "matricula"],
  },
  {
    triggers: ["documento", "documentos", "papelada", "registro", "registros"],
    targets: ["matricula", "cartorio", "observacoes_juridicas"],
  },
  {
    triggers: ["preco", "precos", "valor", "valores", "quanto", "custa", "lance", "mercado"],
    targets: ["valor_minimo", "valor_avaliacao", "valor_mercado", "lance_recomendado", "roi_estimado", "lucro_estimado"],
  },
  {
    triggers: ["localizacao", "endereco", "onde", "rua", "numero", "cep"],
    targets: ["endereco", "rua", "numero", "complemento", "cep", "cidade", "estado"],
  },
  {
    triggers: ["descricao", "resumo", "sobre", "apresentacao"],
    targets: ["titulo", "descricao", "resumo_executivo", "analise"],
  },
  {
    triggers: ["caracteristica", "caracteristicas", "quartos", "banheiros", "area", "tipo"],
    targets: ["tipo_propriedade", "quartos", "banheiros", "area_total", "area_construida", "ano_construcao"],
  },
];

const API_KEYWORD_GROUPS = [
  ["endereco", "rua", "numero", "complemento", "cep", "cidade", "estado", "localizacao"],
  ["valor", "preco", "avaliacao", "minimo", "mercado", "lance", "roi", "lucro"],
  ["leilao", "data", "status"],
  ["ocupacao", "ocupado", "desocupado"],
  ["matricula", "cartorio", "juridico", "documento", "observacoes", "risco", "riscos", "estrategia"],
  ["quarto", "quartos", "banheiro", "banheiros", "area", "construida", "total", "tipo", "propriedade"],
  ["resumo", "descricao", "detalhe", "detalhes", "analise"],
];

const DIRECT_REPLY_FACTUAL_SIGNALS = [
  "matricula",
  "cartorio",
  "cep",
  "rua",
  "numero",
  "cidade",
  "estado",
  "ocupacao",
  "status",
  "data leilao",
  "data do leilao",
  "valor minimo",
  "valor de avaliacao",
  "quartos",
  "banheiros",
  "area total",
  "area construida",
];

const ANALYTICAL_QUERY_SIGNALS = [
  "vale a pena",
  "vale apena",
  "compensa",
  "e uma boa",
  "e bom",
  "e ruim",
  "o que acha",
  "o que voce acha",
  "sua opiniao",
  "opiniao",
  "recomenda",
  "recomendaria",
  "voce faria",
  "devo",
  "deveria",
  "melhor opcao",
  "faz sentido",
  "quais os riscos",
  "principais riscos",
  "pontos de atencao",
  "ponto de atencao",
  "analise",
  "analisa",
  "analisar",
  "resuma",
  "resumo",
  "compare",
  "comparar",
  "comparacao",
  "cuidado",
];

function isAnalyticalQuery(message: string, deps: ApiRuntimeDeps) {
  const normalized = deps.normalizeText(message);
  return ANALYTICAL_QUERY_SIGNALS.some((signal) => normalized.includes(signal));
}

function formatApiFieldLabel(path: string) {
  const segments = path.split(".");
  const leaf = segments[segments.length - 1] ?? path;
  return leaf.replace(/_/g, " ");
}

function formatDirectFieldReply(fieldName: string, value: string | number | boolean, deps: ApiRuntimeDeps) {
  const normalizedField = deps.normalizeText(fieldName);
  const textValue = String(value);

  if (normalizedField.endsWith("matricula")) return `A matricula do imovel e ${textValue}.`;
  if (normalizedField.endsWith("cartorio")) return `O cartorio informado e ${textValue}.`;
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return `Os principais riscos deste imovel sao ${textValue.charAt(0).toLowerCase()}${textValue.slice(1)}`;
  if (normalizedField.endsWith("ocupacao")) return `A ocupacao informada e ${textValue}.`;
  if (normalizedField.endsWith("valor_minimo")) return `O valor minimo do imovel e ${textValue}.`;
  if (normalizedField.endsWith("valor_avaliacao")) return `O valor de avaliacao do imovel e ${textValue}.`;
  if (normalizedField.endsWith("data_leilao")) return `A data do leilao informada e ${textValue}.`;
  if (normalizedField.endsWith("status")) return `O status atual do imovel e ${textValue}.`;
  if (normalizedField.endsWith("rua")) return `A rua informada e ${textValue}.`;
  if (normalizedField.endsWith("numero")) return `O numero informado e ${textValue}.`;
  if (normalizedField.endsWith("cep")) return `O CEP informado e ${textValue}.`;
  if (normalizedField.endsWith("cidade")) return `A cidade do imovel e ${textValue}.`;
  if (normalizedField.endsWith("estado")) return `O estado do imovel e ${textValue}.`;
  if (normalizedField.endsWith("quartos")) return `O imovel tem ${textValue} quartos.`;
  if (normalizedField.endsWith("banheiros")) return `O imovel tem ${textValue} banheiros.`;
  if (normalizedField.endsWith("area_total")) return `A area total informada e ${textValue}.`;
  if (normalizedField.endsWith("area_construida")) return `A area construida informada e ${textValue}.`;
  if (normalizedField.endsWith("descricao") || normalizedField.endsWith("resumo_executivo") || normalizedField.endsWith("analise")) return textValue;

  return `${formatApiFieldLabel(fieldName)}: ${textValue}`;
}

function getApiKeywordGroups(message: string, deps: ApiRuntimeDeps) {
  const normalizedMessage = deps.normalizeText(message);
  const directTokens = deps.buildSearchTokens(message);
  const intentTokens = API_FIELD_INTENTS.flatMap((intent) =>
    intent.triggers.some((trigger) => directTokens.includes(trigger) || normalizedMessage.includes(trigger)) ? intent.targets : [],
  );
  const matchedGroup =
    API_KEYWORD_GROUPS.find(
      (group) =>
        group.some((keyword) => normalizedMessage.includes(keyword)) || group.some((keyword) => directTokens.includes(keyword)),
    ) ?? [];

  return {
    directTokens,
    intentTokens: [...new Set(intentTokens.flatMap((token) => [token, deps.singularizeToken(token)]))],
    relatedTokens: matchedGroup.filter((keyword) => !directTokens.includes(keyword)),
  };
}

function findMatchingApiFields(apiContexts: ApiRuntimeContext[], message: string, deps: ApiRuntimeDeps) {
  const { directTokens, intentTokens, relatedTokens } = getApiKeywordGroups(message, deps);

  return apiContexts.flatMap((api) =>
    api.campos.flatMap((campo) => {
      const normalizedPath = deps.normalizeText(campo.nome);
      const normalizedLabel = deps.normalizeText(formatApiFieldLabel(campo.nome));
      const leafLabel = normalizedLabel.split(".").at(-1) ?? normalizedLabel;
      const directScore = directTokens.reduce((total, keyword) => {
        if (!keyword) return total;
        if (leafLabel === keyword) return total + 60;
        if (normalizedPath === keyword || normalizedLabel === keyword) return total + 40;
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 28;
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 16;
        return total;
      }, 0);

      const intentScore = intentTokens.reduce((total, keyword) => {
        if (!keyword) return total;
        if (leafLabel === keyword) return total + 22;
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 12;
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 6;
        return total;
      }, 0);

      const relatedScore = relatedTokens.reduce((total, keyword) => {
        if (!keyword) return total;
        if (normalizedPath === keyword || normalizedLabel === keyword) return total + 6;
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 4;
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 2;
        return total;
      }, 0);

      const score = directScore + intentScore + relatedScore;
      if (score <= 0) return [];

      return [{ ...campo, apiNome: api.nome, score } satisfies ScoredApiField];
    }),
  );
}

export function buildFocusedApiContext(message: string, apiContexts: ApiRuntimeContext[], deps: ApiRuntimeDeps) {
  const availableApis = apiContexts.filter((api) => api.campos.length > 0);
  const failedApis = apiContexts.filter((api) => api.erro);
  if (!availableApis.length && !failedApis.length) {
    return { instructions: "", fields: [] as ScoredApiField[] };
  }

  const analytical = isAnalyticalQuery(message, deps);
  const explicitApiIntent = /codigo|status|consulta|buscar|verifica|api|integr/i.test(deps.normalizeText(message));

  const matches = findMatchingApiFields(availableApis, message, deps)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 6);

  const preferredFields = ["titulo", "nome", "descricao", "resumo", "categoria", "status", "valor", "preco"];
  const baselineFields = preferredFields.flatMap((field) =>
    availableApis.flatMap((api) =>
      api.campos.flatMap((campo) =>
        deps.normalizeText(campo.nome).endsWith(field)
          ? [{ ...campo, apiNome: api.nome, score: 1 } satisfies ScoredApiField]
          : [],
      ),
    ),
  );

  const fallbackFields =
    explicitApiIntent || analytical
      ? baselineFields.length
        ? baselineFields.slice(0, 5)
        : availableApis
            .flatMap((api) => api.campos.slice(0, 5).map((campo) => ({ ...campo, apiNome: api.nome, score: 1 })))
            .slice(0, 5)
      : [];

  const selectedFields = matches.length ? matches : fallbackFields;
  const fieldLines = selectedFields.map((campo) => `- ${formatApiFieldLabel(campo.nome)} (${campo.nome}): ${String(campo.valor)}`);
  const failedLines = failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`);

  if (!selectedFields.length && !failedLines.length) {
    return { instructions: "", fields: [] as ScoredApiField[] };
  }

  return {
    fields: selectedFields,
    instructions: [
      "Use somente os dados compactados abaixo como fonte da verdade.",
      "Responda apenas com base nesses campos e no historico recente da conversa.",
      "Se a informacao pedida nao estiver presente, diga isso com clareza.",
      analytical ? "Sintetize os dados em conclusao util; nao apenas liste campos." : "",
      fieldLines.length ? "Campos relevantes para esta pergunta:\n" + fieldLines.join("\n") : "",
      failedLines.length ? "APIs indisponiveis:\n" + failedLines.join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function buildDirectApiReply(message: string, apiContexts: ApiRuntimeContext[], deps: ApiRuntimeDeps) {
  const availableApis = apiContexts.filter((api) => api.campos.length > 0);
  if (!availableApis.length) return null;

  const matches = findMatchingApiFields(availableApis, message, deps)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 3);

  if (!matches.length) return null;

  const topScore = matches[0]?.score ?? 0;
  const strongMatches = matches.filter((campo) => campo.score >= topScore - 3);
  if (strongMatches.length > 2 || topScore < 20) return null;

  if (strongMatches.length === 1) {
    return formatDirectFieldReply(strongMatches[0].nome, strongMatches[0].valor, deps);
  }

  return strongMatches.map((campo) => formatDirectFieldReply(campo.nome, campo.valor, deps)).join("\n");
}

export function buildApiFallbackReply(message: string, apiContexts: ApiRuntimeContext[], deps: ApiRuntimeDeps) {
  const analytical = isAnalyticalQuery(message, deps);
  const directReply = buildDirectApiReply(message, apiContexts, deps);
  if (directReply && !analytical) return directReply;

  const focused = buildFocusedApiContext(message, apiContexts, deps);
  if (!focused.fields.length) return null;

  if (analytical) {
    const highlights = focused.fields.slice(0, 3).map((campo) => `- **${formatApiFieldLabel(campo.nome)}:** ${String(campo.valor)}`);
    return [
      "**Conclusao:** com os dados atuais, da para fazer uma avaliacao inicial, mas a recomendacao depende do peso desses pontos no seu contexto.",
      "",
      "**Motivos:**",
      ...highlights,
      "",
      "**Proximo passo:** se voce quiser, eu posso aprofundar a analise com base no criterio que mais importa para voce, como risco, custo, retorno, qualidade ou prioridade.",
    ].join("\n");
  }

  return focused.fields.map((campo) => formatDirectFieldReply(campo.nome, campo.valor, deps)).join("\n");
}

export const API_RUNTIME_FACTUAL_SIGNALS = DIRECT_REPLY_FACTUAL_SIGNALS;
