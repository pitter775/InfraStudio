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

function formatApiDateValue(value: string | number | boolean) {
  const textValue = String(value).trim();
  if (!textValue) return null;

  const date = new Date(textValue);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

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

function isApiContinuationMessage(message: string, deps: ApiRuntimeDeps) {
  const normalized = deps.normalizeText(message).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const words = normalized.split(" ").filter(Boolean);
  if (normalized.length > 48 || words.length > 8) return false;

  if (/^(oi|ola|ol[aá]|bom dia|boa tarde|boa noite)$/.test(normalized)) {
    return false;
  }

  return true;
}

function formatApiFieldLabel(path: string) {
  const segments = path.split(".");
  const leaf = segments[segments.length - 1] ?? path;
  return leaf.replace(/_/g, " ");
}

function formatDirectFieldReply(fieldName: string, value: string | number | boolean, deps: ApiRuntimeDeps) {
  const normalizedField = deps.normalizeText(fieldName);
  const textValue = String(value);
  const formattedDate = formatApiDateValue(value);

  if (normalizedField.endsWith("matricula")) return `A matricula do imovel e ${textValue}.`;
  if (normalizedField.endsWith("cartorio")) return `O cartorio informado e ${textValue}.`;
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return `Os principais riscos deste imovel sao ${textValue.charAt(0).toLowerCase()}${textValue.slice(1)}`;
  if (normalizedField.endsWith("ocupacao")) return `A ocupacao informada e ${textValue}.`;
  if (normalizedField.endsWith("valor_minimo")) return `O valor minimo do imovel e ${textValue}.`;
  if (normalizedField.endsWith("valor_avaliacao")) return `O valor de avaliacao do imovel e ${textValue}.`;
  if (normalizedField.endsWith("data_leilao")) return `📅 A data do leilao informada e ${formattedDate ?? textValue}.`;
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

function formatAnalyticalFieldValue(campo: ScoredApiField) {
  if (campo.nome.endsWith("data_leilao")) {
    return formatApiDateValue(campo.valor) ?? String(campo.valor);
  }

  return String(campo.valor);
}

function getApiFieldIcon(fieldName: string, deps: ApiRuntimeDeps) {
  const normalizedField = deps.normalizeText(fieldName);

  if (normalizedField.endsWith("data_leilao")) return "📅";
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return "⚠️";
  if (normalizedField.endsWith("cartorio") || normalizedField.endsWith("matricula")) return "📄";
  if (normalizedField.endsWith("valor_minimo") || normalizedField.endsWith("valor_avaliacao") || normalizedField.endsWith("valor_mercado") || normalizedField.endsWith("preco")) return "💰";
  if (normalizedField.endsWith("ocupacao") || normalizedField.endsWith("status")) return "🏷️";

  return "•";
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
  const apiContinuation = isApiContinuationMessage(message, deps);

  const matches = findMatchingApiFields(availableApis, message, deps)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 6);

  const preferredFields = [
    "riscos",
    "risco",
    "cartorio",
    "matricula",
    "data_leilao",
    "valor_minimo",
    "valor_avaliacao",
    "valor_mercado",
    "preco",
    "roi_estimado",
    "titulo",
    "nome",
    "descricao",
    "resumo",
    "categoria",
    "status",
  ];
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
    explicitApiIntent || analytical || apiContinuation
      ? baselineFields.length
        ? baselineFields.slice(0, 5)
        : availableApis
            .flatMap((api) => api.campos.slice(0, 5).map((campo) => ({ ...campo, apiNome: api.nome, score: 1 })))
            .slice(0, 5)
      : [];

  const selectedFields = matches.length ? matches : fallbackFields;
  const fieldLines = selectedFields.map((campo) => `- ${formatApiFieldLabel(campo.nome)} (${campo.nome}): ${formatAnalyticalFieldValue(campo)}`);
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
      apiContinuation && !analytical ? "A mensagem atual parece uma continuidade curta; mantenha o contexto factual ja aberto sem reiniciar o atendimento." : "",
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
    const highlights = focused.fields
      .slice(0, 4)
      .map((campo) => `${getApiFieldIcon(campo.nome, deps)} **${formatApiFieldLabel(campo.nome)}:** ${formatAnalyticalFieldValue(campo)}`);
    return [
      "Faz sentido olhar isso com mais calma antes de decidir.",
      "",
      "**Leitura inicial:** com os dados atuais, eu vejo base para uma avaliacao inicial, mas eu nao bateria o martelo sem pesar estes pontos no seu contexto.",
      "",
      "**Motivos:**",
      ...highlights,
      "",
      "**Proximo passo:** se voce quiser, eu sigo com voce pelo criterio que mais pesa agora, como risco, documentacao, custo, retorno ou estrategia de saida.",
    ].join("\n");
  }

  return focused.fields.map((campo) => formatDirectFieldReply(campo.nome, campo.valor, deps)).join("\n");
}

export function buildApiContinuationFallbackReply(apiContexts: ApiRuntimeContext[], deps: ApiRuntimeDeps) {
  const availableApis = apiContexts.filter((api) => api.campos.length > 0);
  if (!availableApis.length) return null;

  const preferredFields = [
    "riscos",
    "risco",
    "cartorio",
    "matricula",
    "data_leilao",
    "status",
    "valor_minimo",
    "preco",
    "roi_estimado",
    "descricao",
    "titulo",
  ];

  const selectedFields = preferredFields.flatMap((field) =>
    availableApis.flatMap((api) =>
      api.campos.flatMap((campo) =>
        deps.normalizeText(campo.nome).endsWith(field)
          ? [{ ...campo, apiNome: api.nome, score: 1 } satisfies ScoredApiField]
          : [],
      ),
    ),
  );

  const deduped = selectedFields.filter(
    (campo, index, list) => list.findIndex((item) => item.nome === campo.nome && item.apiNome === campo.apiNome) === index,
  );

  const fallbackFields = deduped.length
    ? deduped.slice(0, 3)
    : availableApis.flatMap((api) => api.campos.slice(0, 3).map((campo) => ({ ...campo, apiNome: api.nome, score: 1 }))).slice(0, 3);

  if (!fallbackFields.length) return null;

  const highlights = fallbackFields.map((campo) => `${getApiFieldIcon(campo.nome, deps)} **${formatApiFieldLabel(campo.nome)}:** ${formatAnalyticalFieldValue(campo)}`);

  return [
    "Faz sentido olhar isso com mais calma antes de decidir.",
    "",
    "**Leitura inicial:** pelo que ja temos em maos, eu seguiria a analise olhando estes pontos primeiro.",
    "",
    "**Motivos:**",
    ...highlights,
    "",
    "**Proximo passo:** se voce quiser, eu sigo com voce no ponto que mais pesa agora, como risco, documentacao, custo, retorno ou estrategia.",
  ].join("\n");
}

export const API_RUNTIME_FACTUAL_SIGNALS = DIRECT_REPLY_FACTUAL_SIGNALS;
