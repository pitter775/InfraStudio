import "server-only";

import type { AgenteAssetRecord } from "@/lib/agente-assets";
import { getAgenteAtivo, getAgenteById } from "@/lib/agentes";
import { buildAgenteApiRuntimeContext, type ApiRuntimeContext } from "@/lib/apis";
import { getChatChannelPolicy } from "@/lib/chat-channel-policy";
import { getProjetoOpenAIConfig } from "@/lib/segredos";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

type ReplyAsset = {
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image" | "file";
  publicUrl: string;
};

type RuntimeReplyAsset = ReplyAsset & {
  key: string;
};

type ConversationContext = {
  channel?: {
    kind?: string | null;
  };
  ui?: {
    structured_response?: boolean;
    allow_icons?: boolean;
  };
  projeto?: {
    id?: string | null;
    slug?: string | null;
    nome?: string | null;
  };
  agente?: {
    id?: string | null;
    nome?: string | null;
  };
  lead?: {
    nome?: string | null;
    telefone?: string | null;
    identificado?: boolean;
  };
  memoria?: {
    resumo?: string | null;
    mensagem_count?: number;
  };
  qualificacao?: {
    segmento?: string | null;
    dor_principal?: string | null;
    objetivo?: string | null;
    pronto_para_whatsapp?: boolean;
  };
};

function heuristicReply(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("whatsapp") || normalized.includes("atendimento")) {
    return [
      "✓ **Fluxo recomendado**",
      "A InfraStudio monta fluxos de WhatsApp para captar, qualificar e responder clientes com muito menos trabalho manual.",
      "",
      "→ Me diga seu segmento e eu ja te proponho um fluxo inicial.",
    ].join("\n");
  }

  if (normalized.includes("crm") || normalized.includes("erp") || normalized.includes("integra")) {
    return [
      "✓ **Isso encaixa bem em integracao**",
      "A gente costuma integrar CRM, ERP, formularios, pagamentos e atendimento para eliminar retrabalho e centralizar dados.",
      "",
      "→ Se quiser, me diga qual ferramenta voce usa hoje.",
    ].join("\n");
  }

  if (normalized.includes("site") || normalized.includes("chat")) {
    return [
      "✓ **Isso encaixa bem**",
      "Da para colocar um agente no seu site para captar leads, responder duvidas e encaminhar oportunidades para o WhatsApp do time comercial.",
    ].join("\n");
  }

  if (normalized.includes("preco") || normalized.includes("orcamento") || normalized.includes("valor")) {
    return [
      "✓ **Para estimar melhor**",
      "Me diga em uma frase:",
      "- o que voce quer automatizar",
      "- qual etapa hoje mais trava o fechamento",
    ].join("\n");
  }

  return [
    "✓ **Posso te orientar por aqui**",
    "Me conta qual processo voce quer automatizar hoje.",
    "",
    "Se ajudar, pode me dizer se isso envolve:",
    "- site",
    "- WhatsApp",
    "- vendas",
    "- agenda",
    "- integracoes",
  ].join("\n");
}

function buildStructuredReplyInstruction(context?: ConversationContext) {
  const shouldStructure = prefersStructuredReply(context);
  const allowIcons = context?.ui?.allow_icons !== false;

  if (!shouldStructure) {
    return "";
  }

  const lines = [
    "Formato da resposta:",
    "- Prefira respostas escaneaveis, nunca em bloco corrido quando houver mais de uma ideia.",
    "- Use quebras de linha entre contexto, diagnostico, proximos passos e CTA.",
    "- Quando fizer sentido, use listas curtas com '-' ou '1.'.",
    "- Destaque a conclusao e pontos-chave com **negrito**.",
    "- Pode usar icones simples e pontuais como ✓, →, • ou icons discretos para melhorar leitura.",
    "- Pode usar marcadores curtos como '-', '->' e pontos de destaque para melhorar leitura.",
    "- Mantenha o texto elegante e curto, sem excesso de enfeite.",
    "- Quando a base vier de resumo, campos extraidos ou contexto parcial, diga isso com clareza em vez de sugerir que leu tudo.",
  ];

  if (allowIcons) {
    lines.splice(5, 0, "- Se ajudar a leitura, use no maximo 1 ou 2 icones simples como ✓, -> ou •.");
  }

  return lines.join("\n");
}

function isAnalyticalQuery(message: string) {
  const normalized = normalizeText(message);

  return ANALYTICAL_QUERY_SIGNALS.some((signal) => normalized.includes(signal));
}

function buildAnalyticalReplyInstruction(message: string) {
  if (!isAnalyticalQuery(message)) {
    return "";
  }

  return [
    "Pergunta analitica: responda em 3 blocos curtos: **Conclusao**, **Motivos**, **Proximo passo**.",
    "Use **negrito** na conclusao e nos pontos mais importantes.",
    "Nao despeje campos crus.",
    "Aponte risco, trade-off ou incerteza relevante.",
    "Se faltar base para opinar, diga o que falta e faca 1 pergunta curta.",
  ].join("\n");
}

function buildRuntimeReplyAssets(assets: AgenteAssetRecord[]) {
  return assets.slice(0, 12).map((asset, index) => ({
    key: `asset_${index + 1}`,
    id: asset.id,
    nome: asset.nome,
    descricao: asset.descricao,
    arquivoNome: asset.arquivoNome,
    mimeType: asset.mimeType,
    categoria: asset.categoria,
    publicUrl: asset.publicUrl,
  }));
}

function buildAgentAssetInstruction(assets: RuntimeReplyAsset[], latestUserMessage: string) {
  if (!assets.length) {
    return "";
  }

  const userAskedForAsset = userExplicitlyRequestedAsset(latestUserMessage);
  const catalog = assets
    .map((asset) => `- ${asset.key} | ${asset.categoria} | ${asset.nome}${asset.descricao ? ` | ${asset.descricao}` : ""}`)
    .join("\n");

  return [
    "Arquivos disponiveis do agente:",
    catalog,
    userAskedForAsset
      ? "O usuario sinalizou interesse em imagem ou arquivo. Se ajudar, inclua no fim da resposta 1 ou 2 tags como [[asset:asset_1]]."
      : "Use tags [[asset:asset_n]] no fim da resposta apenas quando um arquivo ou imagem agregar valor real.",
  ].join("\n");
}

function userExplicitlyRequestedAsset(message: string) {
  const normalized = normalizeText(message);
  return ASSET_REQUEST_SIGNALS.some((signal) => normalized.includes(signal));
}

function extractTaggedAssets(reply: string, assets: RuntimeReplyAsset[]) {
  const matches = [...reply.matchAll(/\[\[asset:(asset_\d+)]]/gi)];
  const keys = [...new Set(matches.map((match) => match[1]))];
  const selectedAssets = keys
    .map((key) => assets.find((asset) => asset.key.toLowerCase() === key.toLowerCase()))
    .filter(Boolean)
    .slice(0, 2) as RuntimeReplyAsset[];

  const cleanedReply = reply.replace(/\n?\s*\[\[asset:(asset_\d+)]]\s*/gi, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    reply: cleanedReply,
    assets: selectedAssets.map((asset) => ({
      id: asset.id,
      nome: asset.nome,
      descricao: asset.descricao,
      arquivoNome: asset.arquivoNome,
      mimeType: asset.mimeType,
      categoria: asset.categoria,
      publicUrl: asset.publicUrl,
    })),
  };
}

function selectRelevantAssetsHeuristically(message: string, assets: RuntimeReplyAsset[]) {
  if (!assets.length) {
    return [];
  }

  const normalized = normalizeText(message);
  const explicitlyRequested = userExplicitlyRequestedAsset(message);
  const tokens = buildSearchTokens(message);

  const scored = assets
    .map((asset) => {
      const haystack = normalizeText(`${asset.nome} ${asset.descricao} ${asset.arquivoNome}`);
      const score = tokens.reduce((sum, token) => (haystack.includes(token) ? sum + 8 : sum), 0) + (explicitlyRequested ? 6 : 0);
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, explicitlyRequested ? 2 : 1)
    .map((item) => ({
      id: item.asset.id,
      nome: item.asset.nome,
      descricao: item.asset.descricao,
      arquivoNome: item.asset.arquivoNome,
      mimeType: item.asset.mimeType,
      categoria: item.asset.categoria,
      publicUrl: item.asset.publicUrl,
    }));

  if (scored.length) {
    return scored;
  }

  if (explicitlyRequested) {
    return assets.slice(0, 1).map((asset) => ({
      id: asset.id,
      nome: asset.nome,
      descricao: asset.descricao,
      arquivoNome: asset.arquivoNome,
      mimeType: asset.mimeType,
      categoria: asset.categoria,
      publicUrl: asset.publicUrl,
    }));
  }

  return [];
}

function prefersStructuredReply(context?: ConversationContext) {
  if (context?.ui?.structured_response === false) {
    return false;
  }

  return true;
}

function formatHeuristicReply(reply: string, context?: ConversationContext) {
  if (!prefersStructuredReply(context)) {
    return reply;
  }

  return reply
    .replace(/\. ([A-ZÀ-Ú0-9✓→-])/g, ".\n\n$1")
    .replace(/\? ([A-ZÀ-Ú0-9✓→-])/g, "?\n\n$1");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function singularizeToken(token: string) {
  if (token.endsWith("oes")) {
    return `${token.slice(0, -3)}ao`;
  }

  if (token.endsWith("ais")) {
    return `${token.slice(0, -3)}al`;
  }

  if (token.endsWith("eis")) {
    return `${token.slice(0, -3)}el`;
  }

  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 0; i < left.length; i += 1) {
    current[0] = i + 1;

    for (let j = 0; j < right.length; j += 1) {
      const insertion = current[j] + 1;
      const deletion = previous[j + 1] + 1;
      const substitution = previous[j] + (left[i] === right[j] ? 0 : 1);
      current[j + 1] = Math.min(insertion, deletion, substitution);
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function buildSearchTokens(message: string) {
  const stopwords = new Set([
    "qual",
    "quais",
    "qualis",
    "como",
    "sobre",
    "do",
    "da",
    "dos",
    "das",
    "de",
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "me",
    "no",
    "na",
    "projeto",
    "imovel",
    "esse",
    "essa",
    "este",
    "esta",
  ]);

  const tokens = normalizeText(message)
    .split(/\W+/)
    .filter((token) => token.length >= 3 && !stopwords.has(token));

  return [
    ...new Set(
      tokens
        .flatMap((token) => {
          const corrected = correctTokenTypos(token);
          return [token, corrected, singularizeToken(token), singularizeToken(corrected)];
        })
        .filter(Boolean),
    ),
  ];
}

function formatApiFieldLabel(path: string) {
  const segments = path.split(".");
  const leaf = segments[segments.length - 1] ?? path;
  return leaf.replace(/_/g, " ");
}

function formatDirectFieldReply(fieldName: string, value: string | number | boolean) {
  const normalizedField = normalizeText(fieldName);
  const textValue = String(value);

  if (normalizedField.endsWith("matricula")) {
    return `A matricula do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("cartorio")) {
    return `O cartorio informado e ${textValue}.`;
  }

  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) {
    return `Os principais riscos deste imovel sao ${textValue.charAt(0).toLowerCase()}${textValue.slice(1)}`;
  }

  if (normalizedField.endsWith("ocupacao")) {
    return `A ocupacao informada e ${textValue}.`;
  }

  if (normalizedField.endsWith("valor_minimo")) {
    return `O valor minimo do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("valor_avaliacao")) {
    return `O valor de avaliacao do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("data_leilao")) {
    return `A data do leilao informada e ${textValue}.`;
  }

  if (normalizedField.endsWith("status")) {
    return `O status atual do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("rua")) {
    return `A rua informada e ${textValue}.`;
  }

  if (normalizedField.endsWith("numero")) {
    return `O numero informado e ${textValue}.`;
  }

  if (normalizedField.endsWith("cep")) {
    return `O CEP informado e ${textValue}.`;
  }

  if (normalizedField.endsWith("cidade")) {
    return `A cidade do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("estado")) {
    return `O estado do imovel e ${textValue}.`;
  }

  if (normalizedField.endsWith("quartos")) {
    return `O imovel tem ${textValue} quartos.`;
  }

  if (normalizedField.endsWith("banheiros")) {
    return `O imovel tem ${textValue} banheiros.`;
  }

  if (normalizedField.endsWith("area_total")) {
    return `A area total informada e ${textValue}.`;
  }

  if (normalizedField.endsWith("area_construida")) {
    return `A area construida informada e ${textValue}.`;
  }

  if (normalizedField.endsWith("descricao") || normalizedField.endsWith("resumo_executivo") || normalizedField.endsWith("analise")) {
    return textValue;
  }

  return `${formatApiFieldLabel(fieldName)}: ${textValue}`;
}

function shouldUseDirectFieldReply(message: string) {
  const normalized = normalizeText(message);
  const blockedSignals = [
    "resumo",
    "resuma",
    "explica",
    "explique",
    "analise",
    "analisa",
    "analisar",
    "vale a pena",
    "compensa",
    "o que acha",
    "o que voce acha",
    "me fala sobre",
    "me passa um resumo",
    "me diga sobre",
    "quero entender",
    "pontos de atencao",
    "problema",
    "problemas",
    "impedimento",
    "impedimentos",
    "pendencia",
    "pendencias",
    "restricao",
    "restricoes",
    "juridico",
    "juridica",
    "juridicos",
    "juridicas",
    "risco",
    "riscos",
    "detalhe",
    "detalhes",
    "sobre",
    "gostei",
    "bom",
    "ruim",
  ];
  const factualSignals = DIRECT_REPLY_FACTUAL_SIGNALS;
  const tokenCount = buildSearchTokens(message).length;

  if (blockedSignals.some((signal) => normalized.includes(signal))) {
    return false;
  }

  if (tokenCount > 6) {
    return false;
  }

  return factualSignals.some((signal) => normalized.includes(signal));
}

type ScoredApiField = ApiRuntimeContext["campos"][number] & {
  apiNome: string;
  score: number;
};

const API_FIELD_INTENTS = [
  {
    triggers: [
      "problema",
      "problemas",
      "risco",
      "riscos",
      "alerta",
      "alertas",
      "atencao",
      "atencoes",
      "impedimento",
      "impedimentos",
      "pendencia",
      "pendencias",
      "restricao",
      "restricoes",
    ],
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
  "sua opinião",
  "opiniao",
  "opinião",
  "recomenda",
  "recomendaria",
  "voce faria",
  "você faria",
  "devo",
  "deveria",
  "melhor opcao",
  "melhor opção",
  "faz sentido",
  "quais os riscos",
  "quais são os riscos",
  "principais riscos",
  "pontos de atencao",
  "pontos de atenção",
  "ponto de atencao",
  "ponto de atenção",
  "analise",
  "analisa",
  "analisar",
  "resuma",
  "resumo",
  "compare",
  "comparar",
  "comparacao",
  "comparação",
  "cuidado",
];

const ASSET_REQUEST_SIGNALS = [
  "imagem",
  "imagens",
  "foto",
  "fotos",
  "arquivo",
  "arquivos",
  "pdf",
  "documento",
  "documentos",
  "anexo",
  "anexos",
  "manual",
  "catalogo",
  "catálogo",
  "planta",
  "planta baixa",
  "mostra",
  "me envie",
  "me manda",
];

const KNOWN_SEARCH_TERMS = [
  ...new Set([
    ...API_FIELD_INTENTS.flatMap((intent) => [...intent.triggers, ...intent.targets]),
    ...API_KEYWORD_GROUPS.flat(),
    ...DIRECT_REPLY_FACTUAL_SIGNALS.flatMap((signal) => signal.split(/\s+/)),
  ]),
];

function correctTokenTypos(token: string) {
  if (token.length < 4) {
    return token;
  }

  let bestMatch = token;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of KNOWN_SEARCH_TERMS) {
    if (Math.abs(candidate.length - token.length) > 2) {
      continue;
    }

    const distance = levenshteinDistance(token, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestDistance <= 2 ? bestMatch : token;
}

function getApiKeywordGroups(message: string) {
  const normalizedMessage = normalizeText(message);
  const directTokens = buildSearchTokens(message);
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
    intentTokens: [...new Set(intentTokens.flatMap((token) => [token, singularizeToken(token)]))],
    relatedTokens: matchedGroup.filter((keyword) => !directTokens.includes(keyword)),
  };
}

function findMatchingApiFields(apiContexts: ApiRuntimeContext[], message: string) {
  const { directTokens, intentTokens, relatedTokens } = getApiKeywordGroups(message);

  return apiContexts.flatMap((api) =>
    api.campos.flatMap((campo) => {
      const normalizedPath = normalizeText(campo.nome);
      const normalizedLabel = normalizeText(formatApiFieldLabel(campo.nome));
      const leafLabel = normalizedLabel.split(".").at(-1) ?? normalizedLabel;
      const directScore = directTokens.reduce((total, keyword) => {
        if (!keyword) {
          return total;
        }

        if (leafLabel === keyword) {
          return total + 60;
        }

        if (normalizedPath === keyword || normalizedLabel === keyword) {
          return total + 40;
        }

        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) {
          return total + 28;
        }

        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) {
          return total + 16;
        }

        return total;
      }, 0);

      const intentScore = intentTokens.reduce((total, keyword) => {
        if (!keyword) {
          return total;
        }

        if (leafLabel === keyword) {
          return total + 22;
        }

        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) {
          return total + 12;
        }

        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) {
          return total + 6;
        }

        return total;
      }, 0);

      const relatedScore = relatedTokens.reduce((total, keyword) => {
        if (!keyword) {
          return total;
        }

        if (normalizedPath === keyword || normalizedLabel === keyword) {
          return total + 6;
        }

        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) {
          return total + 4;
        }

        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) {
          return total + 2;
        }

        return total;
      }, 0);

      const score = directScore + intentScore + relatedScore;

      if (score <= 0) {
        return [];
      }

      return [
        {
          ...campo,
          apiNome: api.nome,
          score,
        } satisfies ScoredApiField,
      ];
    }),
  );
}

function buildFocusedApiContext(message: string, apiContexts: ApiRuntimeContext[]) {
  const availableApis = apiContexts.filter((api) => api.campos.length > 0);
  const failedApis = apiContexts.filter((api) => api.erro);
  if (!availableApis.length && !failedApis.length) {
    return { instructions: "", fields: [] as ScoredApiField[] };
  }

  const matches = findMatchingApiFields(availableApis, message)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 6);

  const preferredFields = ["titulo", "nome", "descricao", "resumo", "categoria", "status", "valor", "preco"];
  const baselineFields = preferredFields.flatMap((field) =>
    availableApis.flatMap((api) =>
      api.campos.flatMap((campo) =>
        normalizeText(campo.nome).endsWith(field)
          ? [
              {
                ...campo,
                apiNome: api.nome,
                score: 1,
              } satisfies ScoredApiField,
            ]
          : [],
      ),
    ),
  );

  const fallbackFields = baselineFields.length
    ? baselineFields.slice(0, 5)
    : availableApis.flatMap((api) =>
        api.campos.slice(0, 5).map((campo) => ({
          ...campo,
          apiNome: api.nome,
          score: 1,
        })),
      ).slice(0, 5);

  const selectedFields = matches.length ? matches : fallbackFields;
  const fieldLines = selectedFields.map(
    (campo) => `- ${formatApiFieldLabel(campo.nome)} (${campo.nome}): ${String(campo.valor)}`,
  );
  const failedLines = failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`);
  const analytical = isAnalyticalQuery(message);

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

function buildDirectApiReply(message: string, apiContexts: ApiRuntimeContext[]) {
  const availableApis = apiContexts.filter((api) => api.campos.length > 0);
  if (!availableApis.length) {
    return null;
  }

  const matches = findMatchingApiFields(availableApis, message)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 3);

  if (!matches.length) {
    return null;
  }

  const topScore = matches[0]?.score ?? 0;
  const strongMatches = matches.filter((campo) => campo.score >= topScore - 3);
  if (strongMatches.length > 2 || topScore < 20) {
    return null;
  }

  if (strongMatches.length === 1) {
    const campo = strongMatches[0];
    return formatDirectFieldReply(campo.nome, campo.valor);
  }

  return strongMatches.map((campo) => formatDirectFieldReply(campo.nome, campo.valor)).join("\n");
}

function buildApiFallbackReply(message: string, apiContexts: ApiRuntimeContext[]) {
  const analytical = isAnalyticalQuery(message);
  const directReply = buildDirectApiReply(message, apiContexts);
  if (directReply && !analytical) {
    return directReply;
  }

  const focused = buildFocusedApiContext(message, apiContexts);
  if (focused.fields.length) {
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

    return focused.fields.map((campo) => formatDirectFieldReply(campo.nome, campo.valor)).join("\n");
  }

  return null;
}

function buildSystemPrompt(agent: Awaited<ReturnType<typeof getAgenteAtivo>>) {
  const defaultPrompt = [
    "Voce e o agente comercial inicial da InfraStudio.",
    "Seu papel e entender a necessidade do cliente, mostrar capacidade tecnica com objetividade e conduzir para o WhatsApp quando houver intencao comercial.",
    "Foque em automacao, IA, integracoes, sistemas sob medida, atendimento e vendas.",
    "Seja consultivo, direto e convincente sem soar robotico.",
    "Nao invente funcionalidades. Quando faltar contexto, faca uma pergunta curta de qualificacao.",
    "Nunca diga ou sugira que leu edital, matricula, contrato ou documento inteiro se voce recebeu apenas resumo, campos extraidos ou contexto parcial.",
    "Quando responder com base parcial, use formulacoes honestas como 'com base nos dados enviados' ou 'pelo resumo atual'.",
    "Mantenha respostas curtas, normalmente entre 3 e 6 linhas.",
    "Quando houver fit comercial, convide para continuar no WhatsApp.",
  ].join("\n");

  if (!agent) {
    return defaultPrompt;
  }

  const config = agent.configuracoes ?? {};
  const capabilities = Array.isArray(config.capacidades) ? config.capacidades.join(", ") : "";
  const qualifying = Array.isArray(config.perguntas_qualificacao) ? config.perguntas_qualificacao.join(" | ") : "";
  const cta = typeof config.cta_whatsapp === "string" ? config.cta_whatsapp : "";
  const pricingRules = Array.isArray(config.regras_precificacao)
    ? `Regras de precificacao disponiveis: ${JSON.stringify(config.regras_precificacao)}`
    : "";
  const handoff = config.handoff ? `Regras de handoff: ${JSON.stringify(config.handoff)}` : "";

  return [
    defaultPrompt,
    agent.nome ? `Nome do agente: ${agent.nome}` : "",
    agent.descricao ? `Descricao: ${agent.descricao}` : "",
    agent.promptBase ? `Prompt base: ${agent.promptBase}` : "",
    capabilities ? `Capacidades principais: ${capabilities}` : "",
    qualifying ? `Perguntas de qualificacao sugeridas: ${qualifying}` : "",
    pricingRules,
    handoff,
    cta ? `Orientacao de CTA: ${cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInput(messages: ConversationMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    content: [{ type: "input_text", text: message.content }],
  }));
}

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  model?: string;
};

function extractOutputText(payload: OpenAIResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" || typeof content.text === "string")
      .map((content) => content.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return parts.join("\n").trim();
}

type CatalogItem = {
  slug: "site-comum" | "chat-ia" | "automacao-whatsapp" | "integracao-crm" | "sistema-sob-medida-simples";
  nome: string;
  preco: number;
};

function detectCatalogItems(history: ConversationMessage[]) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => normalizeText(item.content))
    .join(" ");

  const items: CatalogItem[] = [];
  const has = (pattern: RegExp) => pattern.test(userText);

  if (has(/\bsite\b|\blanding page\b|\bpagina\b/)) {
    items.push({ slug: "site-comum", nome: "Site comum", preco: 300 });
  }

  if (has(/\bchat\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b/)) {
    items.push({ slug: "chat-ia", nome: "Chat com IA", preco: 700 });
  }

  if (has(/\bwhatsapp\b|\bautomatiza(?:r|cao) whatsapp\b|\batendimento no whatsapp\b/)) {
    items.push({ slug: "automacao-whatsapp", nome: "Automacao WhatsApp", preco: 1000 });
  }

  if (has(/\bcrm\b|\bintegrac(?:ao|a)o com crm\b/)) {
    items.push({ slug: "integracao-crm", nome: "Integracao CRM", preco: 1000 });
  }

  if (has(/\bsistema\b|\bpainel\b|\bcadastro\b|\bproduto\b|\bprodutos\b|\badmin\b|\badm\b|\blistagem\b|\bcatalogo\b|\bcatalogo\b/)) {
    items.push({ slug: "sistema-sob-medida-simples", nome: "Sistema sob medida simples", preco: 2000 });
  }

  return items.filter((item, index, array) => array.findIndex((entry) => entry.slug === item.slug) === index);
}

function isOutOfScopeForCatalog(history: ConversationMessage[]) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => normalizeText(item.content))
    .join(" ");

  const complexSignals = [
    /\berp\b/,
    /\bintegrac(?:ao|a)o(?:es)?\b/,
    /\bmuitas regras\b/,
    /\bfluxos\b/,
    /\bprocessos\b/,
    /\bsistema interno\b/,
    /\bsob medida\b/,
    /\bvarios\b/,
    /\bcomplex[oa]\b/,
    /\bmais de um\b/,
  ];

  const catalogItems = detectCatalogItems(history);
  return catalogItems.length === 0 || complexSignals.some((pattern) => pattern.test(userText));
}

function buildCatalogPricingReply(history: ConversationMessage[], context?: ConversationContext) {
  const catalogItems = detectCatalogItems(history);
  if (catalogItems.length === 0 || isOutOfScopeForCatalog(history)) {
    return null;
  }

  const total = catalogItems.reduce((sum, item) => sum + item.preco, 0);
  const labels = catalogItems.map((item) => `${item.nome}: R$ ${item.preco.toLocaleString("pt-BR")}`);
  const joinedLabels = labels.join(" + ");

  if (catalogItems.length === 1) {
    return prefersStructuredReply(context)
      ? [
          "✓ **Melhor encaixe inicial**",
          labels[0],
          "",
          "→ Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo.",
        ].join("\n")
      : `Pelo que voce descreveu, isso encaixa em ${joinedLabels}. Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo.`;
  }

  return prefersStructuredReply(context)
    ? [
        "✓ **Melhor encaixe inicial**",
        ...labels.map((label) => `- ${label}`),
        "",
        `**Estimativa inicial:** R$ ${total.toLocaleString("pt-BR")}`,
        "",
        "→ Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais.",
      ].join("\n")
    : `Pelo que voce descreveu, isso encaixa no nosso catalogo como ${joinedLabels}. Nesse cenario, a estimativa inicial fica em R$ ${total.toLocaleString("pt-BR")} no total. Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais.`;
}

function maybeAskForLeadIdentification(context: ConversationContext, history: ConversationMessage[], latestUserMessage: string) {
  const count = context.memoria?.mensagem_count ?? 0;
  const identified = Boolean(context.lead?.identificado);
  const ready = Boolean(context.qualificacao?.pronto_para_whatsapp);
  const normalized = normalizeText(latestUserMessage);

  if (identified) {
    return null;
  }

  if (!isOutOfScopeForCatalog(history)) {
    return null;
  }

  if (ready || count >= 4 || normalized.includes("orcamento") || normalized.includes("whatsapp")) {
    return "Consigo seguir com voce por aqui, mas para te direcionar melhor no WhatsApp me envie seu nome e telefone com DDD.";
  }

  return null;
}

export async function generateSalesReply(history: ConversationMessage[], context?: ConversationContext) {
  const latestUserMessage = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const channelPolicy = getChatChannelPolicy(context);
  const projectId = context?.projeto?.id ?? null;
  const agentId = context?.agente?.id ?? null;
  const agent = agentId ? await getAgenteById(agentId) : projectId ? await getAgenteAtivo(projectId) : null;
  const runtimeAssets = buildRuntimeReplyAssets(agent?.arquivos ?? []);
  const apiContexts = agent?.id ? await buildAgenteApiRuntimeContext(agent.id, (context ?? {}) as Record<string, unknown>) : [];
  const openai = await getProjetoOpenAIConfig(projectId);
  const systemPrompt = buildSystemPrompt(agent);
  const structuredReplyInstruction = buildStructuredReplyInstruction(context);
  const analyticalReplyInstruction = buildAnalyticalReplyInstruction(latestUserMessage);
  const agentAssetInstruction = buildAgentAssetInstruction(runtimeAssets, latestUserMessage);
  const focusedApiContext = buildFocusedApiContext(latestUserMessage, apiContexts);
  const catalogPricingReply = channelPolicy.allowCatalogPricing ? buildCatalogPricingReply(history, context) : null;
  const canUseDirectReply = shouldUseDirectFieldReply(latestUserMessage) && !isAnalyticalQuery(latestUserMessage);
  const directApiReply = canUseDirectReply ? buildDirectApiReply(latestUserMessage, apiContexts) : null;

  if (catalogPricingReply && apiContexts.length === 0) {
    return {
      reply: catalogPricingReply,
      assets: selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "catalog_pricing",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  const identificationPrompt = channelPolicy.allowLeadGate
    ? maybeAskForLeadIdentification(context ?? {}, history, latestUserMessage)
    : null;

  if (identificationPrompt && apiContexts.length === 0) {
      return {
      reply: formatHeuristicReply(identificationPrompt, context),
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "lead_identification_gate",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (directApiReply) {
      return {
      reply: directApiReply,
      assets: selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "direct_api_field",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (!openai.apiKey) {
    const apiFallbackReply = buildApiFallbackReply(latestUserMessage, apiContexts);
    return {
      reply: formatHeuristicReply(apiFallbackReply ?? heuristicReply(latestUserMessage), context),
      assets: selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: { provider: "heuristic", model: "fallback", agenteId: agent?.id ?? null, agenteNome: agent?.nome ?? null },
    };
  }

  try {
    const hasSummary = Boolean(context?.memoria?.resumo);
    const recentMessages = history.slice(hasSummary ? -2 : -4);
    const latestUserTurn = [...history].reverse().find((item) => item.role === "user");
    const summary = context?.memoria?.resumo ? `Resumo estruturado atual do chat (JSON compacto): ${context.memoria.resumo}` : "";
    const lead = context?.lead?.identificado
      ? `Lead identificado: nome=${context.lead?.nome ?? ""}; telefone=${context.lead?.telefone ?? ""}.`
      : "Lead ainda nao identificado.";
    const qualification = [
      context?.qualificacao?.segmento ? `Segmento: ${context.qualificacao.segmento}.` : "",
      context?.qualificacao?.objetivo ? `Objetivo: ${context.qualificacao.objetivo}.` : "",
      context?.qualificacao?.dor_principal ? `Dor principal: ${context.qualificacao.dor_principal}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const requestPayload = {
      model: openai.model,
      temperature: 0.5,
      max_output_tokens: 220,
      instructions: [systemPrompt, structuredReplyInstruction, analyticalReplyInstruction, agentAssetInstruction, focusedApiContext.instructions, summary, lead, qualification]
        .filter(Boolean)
        .join("\n\n"),
      input: buildInput(latestUserTurn ? [...recentMessages.filter((item) => item !== latestUserTurn), latestUserTurn] : recentMessages),
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openai.apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const payload = (await response.json()) as OpenAIResponsesPayload;
    const outputText = extractOutputText(payload);

    if (!response.ok || !outputText) {
      console.error("[chat] openai response failed", payload.error?.message ?? payload);
      const apiFallbackReply = buildApiFallbackReply(latestUserMessage, apiContexts);
      return {
        reply: formatHeuristicReply(apiFallbackReply ?? heuristicReply(latestUserMessage), context),
        assets: selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets),
        usage: { inputTokens: 0, outputTokens: 0 },
        metadata: {
          provider: "heuristic",
          model: "fallback_after_openai_error",
          agenteId: agent?.id ?? null,
          agenteNome: agent?.nome ?? null,
        },
      };
    }

    const resolvedReply = extractTaggedAssets(outputText, runtimeAssets);
    const fallbackAssets =
      resolvedReply.assets.length === 0 && userExplicitlyRequestedAsset(latestUserMessage)
        ? selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets)
        : resolvedReply.assets;

    return {
      reply: resolvedReply.reply,
      assets: fallbackAssets,
      usage: {
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
      },
      metadata: {
        provider: "openai",
        model: payload.model ?? openai.model,
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
        debugRequest: {
          hasSummary,
          allowIcons: context?.ui?.allow_icons !== false,
          structuredResponse: context?.ui?.structured_response !== false,
          historyLength: history.length,
          requestPayload,
        },
      },
    };
  } catch (error) {
    console.error("[chat] failed to call openai", error);
    const apiFallbackReply = buildApiFallbackReply(latestUserMessage, apiContexts);
    return {
      reply: formatHeuristicReply(apiFallbackReply ?? heuristicReply(latestUserMessage), context),
      assets: selectRelevantAssetsHeuristically(latestUserMessage, runtimeAssets),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "fallback_after_exception",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }
}

function extractPhone(message: string) {
  const digits = message.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function extractName(message: string) {
  const match = message.match(/(?:meu nome(?: e| eh)?|sou o|sou a)\s+([a-zà-ú ]{3,})/i);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  if (!extractPhone(message)) {
    return null;
  }

  const candidate = message
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .replace(/\b(?:meu|nome|e|eh|sou|o|a|telefone|fone|celular|zap|whatsapp|ddd|com)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || !/^[A-Za-zÃ-Ã¿][A-Za-zÃ-Ã¿' -]*$/.test(candidate)) {
    return null;
  }

  const words = candidate.split(/\s+/).filter((word) => word.length >= 2);
  if (words.length === 0 || words.length > 4) {
    return null;
  }

  return words.join(" ");
}

export function enrichLeadContext(
  currentContext: Record<string, unknown> | null,
  history: ConversationMessage[],
  latestUserMessage: string,
) {
  const context = (currentContext ?? {}) as {
    origem?: string;
    lead?: { nome?: string | null; telefone?: string | null; email?: string | null; identificado?: boolean };
    memoria?: { resumo?: string | null; mensagem_count?: number; ultimo_resumo_at?: string | null };
    qualificacao?: {
      segmento?: string | null;
      dor_principal?: string | null;
      objetivo?: string | null;
      pronto_para_whatsapp?: boolean;
    };
  };

  const phone = extractPhone(latestUserMessage);
  const name = extractName(latestUserMessage);
  const nextCount = history.filter((item) => item.role !== "system").length;

  const nextContext = {
    origem: context.origem ?? "site",
    projeto: {
      id: (currentContext as { projeto?: { id?: string | null } } | null)?.projeto?.id ?? null,
      slug: (currentContext as { projeto?: { slug?: string | null } } | null)?.projeto?.slug ?? null,
      nome: (currentContext as { projeto?: { nome?: string | null } } | null)?.projeto?.nome ?? null,
    },
    agente: {
      id: (currentContext as { agente?: { id?: string | null } } | null)?.agente?.id ?? null,
      nome: (currentContext as { agente?: { nome?: string | null } } | null)?.agente?.nome ?? null,
    },
    lead: {
      nome: name ?? context.lead?.nome ?? null,
      telefone: phone ?? context.lead?.telefone ?? null,
      email: context.lead?.email ?? null,
      identificado: Boolean((phone ?? context.lead?.telefone) && (name ?? context.lead?.nome)),
    },
    memoria: {
      resumo: context.memoria?.resumo ?? null,
      mensagem_count: nextCount,
      ultimo_resumo_at: context.memoria?.ultimo_resumo_at ?? null,
    },
    qualificacao: {
      segmento: context.qualificacao?.segmento ?? null,
      dor_principal: context.qualificacao?.dor_principal ?? null,
      objetivo: context.qualificacao?.objetivo ?? null,
      pronto_para_whatsapp: context.qualificacao?.pronto_para_whatsapp ?? false,
    },
  };

  const normalized = latestUserMessage.toLowerCase();

  if (!nextContext.qualificacao.segmento) {
    if (normalized.includes("imobili")) nextContext.qualificacao.segmento = "imobiliaria";
    else if (normalized.includes("clin")) nextContext.qualificacao.segmento = "clinica";
    else if (normalized.includes("loja") || normalized.includes("e-commerce")) nextContext.qualificacao.segmento = "loja";
  }

  if (!nextContext.qualificacao.objetivo) {
    if (normalized.includes("whatsapp")) nextContext.qualificacao.objetivo = "automatizar atendimento no WhatsApp";
    else if (normalized.includes("crm")) nextContext.qualificacao.objetivo = "integrar CRM";
    else if (normalized.includes("site") || normalized.includes("chat")) nextContext.qualificacao.objetivo = "implantar agente no site";
  }

  return nextContext;
}

export function shouldRefreshSummary(messageCount: number) {
  return messageCount > 0 && messageCount % 4 === 0;
}

export async function summarizeConversation(
  history: ConversationMessage[],
  currentSummary: string | null | undefined,
  projectId?: string | null,
) {
  const recent = history.slice(-6);
  const openai = await getProjetoOpenAIConfig(projectId);

  if (!openai.apiKey) {
    const compact = recent
      .map((item) => `${item.role === "assistant" ? "assistente" : "cliente"}:${item.content}`)
      .join(" | ")
      .slice(0, 320);

    return JSON.stringify({
      objetivo: null,
      lead: null,
      restricoes: compact || null,
      proximo_passo: currentSummary ? String(currentSummary).slice(0, 180) : null,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openai.apiKey}`,
      },
      body: JSON.stringify({
        model: openai.model,
        temperature: 0.2,
        max_output_tokens: 110,
        instructions:
          'Resuma a conversa em portugues usando JSON compacto valido, sem markdown. Use somente as chaves: objetivo, lead, restricoes, proximo_passo. Cada valor deve ser curto. Em lead, use um objeto com nome, telefone e identificado quando existir.',
        input: buildInput([
          ...(currentSummary ? [{ role: "system" as const, content: `Resumo anterior: ${currentSummary}` }] : []),
          ...recent,
        ]),
      }),
    });

    const payload = (await response.json()) as OpenAIResponsesPayload;
    return extractOutputText(payload) || currentSummary || null;
  } catch (error) {
    console.error("[chat] failed to summarize conversation", error);
    return currentSummary ?? null;
  }
}
