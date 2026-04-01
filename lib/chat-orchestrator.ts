import "server-only";

import type { AgenteAssetRecord } from "@/lib/agente-assets";
import { getAgenteById, type AgenteRecord } from "@/lib/agentes";
import { normalizeAgentRuntimeConfig, selectAgentRuntimeLines } from "@/lib/agent-runtime";
import { buildAgenteApiRuntimeContext, type ApiRuntimeContext } from "@/lib/apis";
import { getChatChannelPolicy } from "@/lib/chat-channel-policy";
import { listConectoresByAgente, MERCADO_LIVRE_CONNECTOR_TYPE } from "@/lib/conectores";
import {
  buscarProdutosMercadoLivrePorAgente,
  listarProdutosRecentesMercadoLivrePorAgente,
  obterDetalhesProdutoMercadoLivrePorAgente,
  type ProdutoDetalhadoMercadoLivre,
  type ProdutoPadronizado,
} from "@/lib/mercado-livre";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
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
  targetUrl?: string | null;
};

type RuntimeReplyAsset = ReplyAsset & {
  key: string;
};

type CatalogProductReference = {
  id?: string | null;
  nome?: string | null;
  descricao?: string | null;
  preco?: number | null;
  link?: string | null;
  imagem?: string | null;
};

type ConversationContext = {
  channel?: {
    kind?: string | null;
  };
  admin?: {
    projetoId?: string | null;
    agenteId?: string | null;
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
    locked?: boolean;
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
  catalogo?: {
    ultimaBusca?: string | null;
    produtoAtual?: CatalogProductReference | null;
    ultimosProdutos?: Array<{
      id?: string | null;
      nome?: string | null;
      descricao?: string | null;
      preco?: number | null;
      link?: string | null;
      imagem?: string | null;
    }>;
  };
};

function heuristicReply(message: string, context?: ConversationContext) {
  if (isWhatsAppChannel(context)) {
    return buildWhatsAppHeuristicReply(message, context);
  }

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

function isWhatsAppChannel(context?: ConversationContext) {
  return (context?.channel?.kind ?? "").trim().toLowerCase() === "whatsapp";
}

function isShortFollowUp(message: string) {
  const compact = normalizeText(message).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }

  const words = compact.split(" ").filter(Boolean);
  return compact.length <= 24 && words.length <= 4;
}

function buildWhatsAppHeuristicReply(message: string, context?: ConversationContext) {
  const normalized = normalizeText(message);
  const objective = normalizeText(context?.qualificacao?.objetivo ?? "");

  if (/\bagenda\b|agendamento|calendario/.test(normalized)) {
    return [
      "Consigo te ajudar com agenda sim.",
      "Voce quer automatizar agendamento, confirmacao ou lembrete?",
    ].join("\n\n");
  }

  if (/\bsite\b|\bchat\b/.test(normalized)) {
    return [
      "Da para colocar um agente no seu site e conectar com o comercial.",
      "Voce quer captar leads, tirar duvidas ou agendar atendimento?",
    ].join("\n\n");
  }

  if (/\bwhatsapp\b|\batendimento\b/.test(normalized)) {
    return [
      "Da para automatizar o atendimento no WhatsApp sem perder o toque humano.",
      "Hoje voce quer focar em captacao, qualificacao ou suporte?",
    ].join("\n\n");
  }

  if (/\bcrm\b|\berp\b|integrac/.test(normalized)) {
    return [
      "Consigo integrar isso com CRM e outras ferramentas.",
      "Qual sistema voce usa hoje?",
    ].join("\n\n");
  }

  if (/\bvendas?\b|comercial|lead/.test(normalized)) {
    return [
      "Boa. Da para organizar melhor entrada, qualificacao e repasse dos leads.",
      "Seu gargalo hoje esta em captar, responder ou fechar?",
    ].join("\n\n");
  }

  if (isShortFollowUp(message) && objective.includes("agenda")) {
    return [
      "Fechado. Em agenda, o melhor fluxo depende do seu caso.",
      "Voce quer marcar horario, confirmar consultas ou mandar lembretes?",
    ].join("\n\n");
  }

  return [
    "Consigo te orientar por aqui.",
    "Me diz em uma frase o que voce quer automatizar hoje.",
  ].join("\n\n");
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

function buildChannelReplyInstruction(context?: ConversationContext) {
  if (!isWhatsAppChannel(context)) {
    return "";
  }

  return [
    "Canal atual: WhatsApp.",
    "Responda de forma mais humana e natural, como conversa comercial real no WhatsApp.",
    "Prefira respostas curtas, normalmente entre 2 e 4 linhas.",
    "Faca uma pergunta por vez.",
    "Nao repita a resposta anterior com outras palavras.",
    "Quando o cliente mandar algo curto como 'agenda', 'site', 'sim' ou 'quero', trate isso como continuacao do contexto.",
    "Pode usar no maximo 1 icone simples quando ajudar a leitura, sem exagero.",
    "Evite blocos longos, listas extensas e tom robotico.",
  ].join("\n");
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
    return isWhatsAppChannel(context) ? reply.replace(/\n{3,}/g, "\n\n").trim() : reply;
  }

  return reply
    .replace(/\. ([A-ZÀ-Ú0-9✓→-])/g, ".\n\n$1")
    .replace(/\? ([A-ZÀ-Ú0-9✓→-])/g, "?\n\n$1");
}

function buildNeutralGlobalFallbackReply(agent: AgenteRecord | null, context?: ConversationContext) {
  const objective =
    normalizeAgentRuntimeConfig(agent?.configuracoes?.runtime)?.overview.objetivo?.trim() ||
    context?.qualificacao?.objetivo?.trim() ||
    agent?.descricao?.trim() ||
    context?.projeto?.nome?.trim() ||
    "este atendimento";

  return [
    `Sigo por aqui no contexto de ${agent?.nome ?? "atendimento"}.`,
    `Me diga o ponto exato que voce quer validar em ${objective}.`,
  ].join("\n\n");
}

function buildMercadoLivreFocusedFallbackReply(agent: AgenteRecord | null) {
  return [
    `Sigo por aqui no contexto de ${agent?.nome ?? "atendimento"}.`,
    "Como este agente esta focado na loja do Mercado Livre, me diga o produto, modelo, marca, cor ou SKU que voce quer buscar.",
  ].join("\n\n");
}

function isInfraStudioFirstPartyContext(context?: ConversationContext) {
  const channelKind = normalizeText(context?.channel?.kind ?? "");
  if (channelKind === "admin_agent_test") {
    return false;
  }

  const projetoSlug = normalizeText(context?.projeto?.slug ?? "");
  const projetoNome = normalizeText(context?.projeto?.nome ?? "");
  return projetoSlug === "infrastudio" || projetoNome === "infrastudio";
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

  const explicitApiIntent = /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalizeText(message));

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

  const fallbackFields =
    explicitApiIntent
      ? baselineFields.length
        ? baselineFields.slice(0, 5)
        : availableApis
            .flatMap((api) =>
              api.campos.slice(0, 5).map((campo) => ({
                ...campo,
                apiNome: api.nome,
                score: 1,
              })),
            )
            .slice(0, 5)
      : [];

  const selectedFields = matches.length ? matches : fallbackFields;
  const fieldLines = selectedFields.map(
    (campo) => `- ${formatApiFieldLabel(campo.nome)} (${campo.nome}): ${String(campo.valor)}`,
  );
  const failedLines = failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`);
  const analytical = isAnalyticalQuery(message);

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

function buildAgentScopedRecoveryReply(input: {
  message: string;
  context?: ConversationContext;
  agent: AgenteRecord | null;
  apiContexts: ApiRuntimeContext[];
  hasMercadoLivreConnector: boolean;
}) {
  const firstPartyFallback = isInfraStudioFirstPartyContext(input.context) ? heuristicReply(input.message, input.context) : null;
  if (firstPartyFallback?.trim()) {
    return formatHeuristicReply(firstPartyFallback, input.context);
  }

  const runtime = normalizeAgentRuntimeConfig(input.agent?.configuracoes?.runtime);
  const objective =
    runtime?.overview.objetivo?.trim() ||
    input.context?.qualificacao?.objetivo?.trim() ||
    input.agent?.descricao?.trim() ||
    input.context?.projeto?.nome?.trim() ||
    "este atendimento";

  if (isWhatsAppChannel(input.context)) {
    const baseReply = [
      `Sigo por aqui no contexto de ${input.agent?.nome ?? "atendimento"}.`,
      `Me diga o ponto exato que voce quer validar em ${objective}: risco, valor, status, documentos ou detalhes.`,
    ].join("\n\n");

    const apiReply = /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalizeText(input.message))
      ? buildApiFallbackReply(input.message, input.apiContexts)
      : null;

    return apiReply ? formatHeuristicReply(apiReply, input.context) : baseReply;
  }

  const neutralFallbackReply = buildNeutralGlobalFallbackReply(input.agent, input.context);
  const mercadoLivreFallbackReply = input.hasMercadoLivreConnector
    ? buildMercadoLivreFocusedFallbackReply(input.agent)
    : neutralFallbackReply;
  const baseReply = isInfraStudioFirstPartyContext(input.context)
    ? [
        `Sigo por aqui no contexto de ${input.agent?.nome ?? "atendimento"}.`,
        `Me diga o ponto exato que voce quer validar em ${objective}: risco, valor, status, documentos ou detalhes.`,
      ].join("\n\n")
    : mercadoLivreFallbackReply;

  const apiReply = /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalizeText(input.message))
    ? buildApiFallbackReply(input.message, input.apiContexts)
    : null;

  return apiReply ? formatHeuristicReply(apiReply, input.context) : baseReply;
}

function buildSystemPrompt(agent: AgenteRecord | null, context?: ConversationContext, hasMercadoLivreConnector = false) {
  const defaultPrompt = [
    "Voce e o agente comercial inicial da InfraStudio.",
    "Seu papel e entender a necessidade do cliente, mostrar capacidade tecnica com objetividade e conduzir para o WhatsApp quando houver intencao comercial.",
    "Foque em automacao, IA, integracoes, sistemas sob medida, atendimento e vendas.",
    "Seja consultivo, direto e convincente sem soar robotico.",
    "Nao invente funcionalidades. Quando faltar contexto, faca uma pergunta curta de qualificacao.",
    !context?.lead?.nome ? "Nos primeiros momentos do atendimento, priorize descobrir e confirmar o primeiro nome da pessoa com naturalidade antes de aprofundar a qualificacao." : "",
    "Nunca diga ou sugira que leu edital, matricula, contrato ou documento inteiro se voce recebeu apenas resumo, campos extraidos ou contexto parcial.",
    "Quando responder com base parcial, use formulacoes honestas como 'com base nos dados enviados' ou 'pelo resumo atual'.",
    isWhatsAppChannel(context) ? "No WhatsApp, mantenha respostas curtas, normalmente entre 2 e 4 linhas." : "Mantenha respostas curtas, normalmente entre 3 e 6 linhas.",
    "Quando houver fit comercial, convide para continuar no WhatsApp.",
    hasMercadoLivreConnector
      ? "Este agente pode ter varias integracoes, mas quando o Mercado Livre estiver conectado ele deve receber peso maior na interpretacao das mensagens sobre loja, produtos, anuncios, disponibilidade e variacoes."
      : "",
    hasMercadoLivreConnector
      ? "Quando a mensagem for ambigua, interprete primeiro como uma busca ou duvida sobre produto do Mercado Livre, sem ignorar outras capacidades se a pessoa pedir algo claramente diferente."
      : "",
    hasMercadoLivreConnector
      ? "Se faltar contexto, faca uma pergunta curta pedindo nome do produto, modelo, marca, cor, tamanho ou SKU."
      : "",
    hasMercadoLivreConnector
      ? "Quando a pessoa demonstrar interesse em um produto especifico, mude de modo catalogo para modo venda: destaque beneficios concretos do anuncio, reduza inseguranca, responda objecoes e conduza para decisao."
      : "",
    hasMercadoLivreConnector
      ? "Depois de identificar um produto especifico, evite voltar para respostas genericas de busca. Use os dados do anuncio para argumentar melhor e fechar o proximo passo."
      : "",
    hasMercadoLivreConnector
      ? "Se houver detalhes do produto em foco, priorize atributos, garantia, condicao, estoque, vendas e frete. Feche com uma pergunta comercial curta."
      : "",
  ].join("\n");

  if (!agent) {
    return defaultPrompt;
  }
  return [
    defaultPrompt,
    agent.nome ? `Nome do agente: ${agent.nome}` : "",
    agent.descricao ? `Descricao curta: ${agent.descricao}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function detectPromptRoute(latestUserMessage: string, context: ConversationContext | undefined, apiContexts: ApiRuntimeContext[]) {
  const normalized = normalizeText(latestUserMessage);
  const channelKind = context?.channel?.kind ?? "";
  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const greetingSignals = new Set(["oi", "ola", "olá", "opa", "e ai", "ei", "bom dia", "boa tarde", "boa noite"]);

  if (
    compact &&
    compact.length <= 18 &&
    [...greetingSignals].some((item) => compact === normalizeText(item))
  ) {
    return "greeting" as const;
  }

  if (channelKind.includes("whatsapp") || normalized.includes("whatsapp") || normalized.includes("zap")) {
    return "whatsapp" as const;
  }

  if (
    normalized.includes("preco") ||
    normalized.includes("orcamento") ||
    normalized.includes("valor") ||
    normalized.includes("proposta") ||
    normalized.includes("fechar")
  ) {
    return "pricing" as const;
  }

  if (apiContexts.length > 0 && /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalized)) {
    return "api" as const;
  }

  return "default" as const;
}

function buildRuntimePrompt(
  agent: AgenteRecord | null,
  latestUserMessage: string,
  context: ConversationContext | undefined,
  apiContexts: ApiRuntimeContext[],
) {
  const runtime = normalizeAgentRuntimeConfig(agent?.configuracoes?.runtime);
  if (!runtime) {
    return "";
  }

  const route = detectPromptRoute(latestUserMessage, context, apiContexts);
  const blockKeys = runtime.routes[route];
  const selectedLines = selectAgentRuntimeLines(runtime, blockKeys);

  if (!selectedLines.length) {
    return "";
  }

  return [
    "Runtime operacional do agente:",
    `Objetivo central: ${runtime.overview.objetivo}`,
    runtime.overview.descricao_curta ? `Descricao curta: ${runtime.overview.descricao_curta}` : "",
    `Rota atual: ${route}`,
    `Blocos ativos: ${blockKeys.join(", ")}`,
    ...selectedLines.map((line) => `- ${line}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLegacyAgentPrompt(agent: AgenteRecord | null) {
  if (!agent) {
    return "";
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
    agent.promptBase ? `Prompt base do agente:\n${agent.promptBase}` : "",
    agent.nome ? `Nome do agente: ${agent.nome}` : "",
    agent.descricao ? `Descricao: ${agent.descricao}` : "",
    capabilities ? `Capacidades principais: ${capabilities}` : "",
    qualifying ? `Perguntas de qualificacao sugeridas: ${qualifying}` : "",
    pricingRules,
    handoff,
    cta ? `Orientacao de CTA: ${cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function shouldSearchProducts(message: string) {
  const normalized = normalizeText(message);
  const commercialServiceSignals = [
    /\bpreco\b/,
    /\bvalor\b/,
    /\borcamento\b/,
    /\bquanto\b/,
    /\bmedia de valor\b/,
    /\bestimativa\b/,
    /\bsistema\b/,
    /\bsite\b/,
    /\bchat\b/,
    /\bagente\b/,
    /\bautomac(?:ao|a)o\b/,
    /\bintegrac(?:ao|a)o\b/,
    /\bwhatsapp\b/,
  ];

  if (commercialServiceSignals.some((pattern) => pattern.test(normalized))) {
    const explicitCatalogSignals = [
      /\bproduto\b/,
      /\bprodutos\b/,
      /\bitem\b/,
      /\bitens\b/,
      /\bcatalogo\b/,
      /\bcatálogo\b/,
      /\bloja\b/,
      /\bmercado livre\b/,
      /\bml\b/,
      /\bsku\b/,
      /\bmodelo\b/,
      /\bcor\b/,
      /\btamanho\b/,
    ];

    if (!explicitCatalogSignals.some((pattern) => pattern.test(normalized))) {
      return false;
    }
  }

  const productSignals = [
    "tem algum",
    "tem alguma",
    "voce tem",
    "tem ai",
    "produto",
    "produtos",
    "item",
    "itens",
    "catalogo",
    "catálogo",
    "loja",
    "mercado livre",
    "ml",
    "venda",
    "vende",
    "disponivel",
    "disponível",
    "procuro",
    "quero comprar",
    "estou procurando",
  ];

  if (productSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  return /\btem\b.+\b(produt|item|modelo|cor|tamanho|sku|na loja)\b/.test(normalized);
}

function shouldContinueProductSearch(history: ConversationMessage[], latestUserMessage: string, context?: ConversationContext) {
  const normalized = normalizeText(latestUserMessage).trim();
  if (!normalized) {
    return false;
  }

  if (/\b(preco|valor|orcamento|quanto|media de valor|estimativa|sistema|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp)\b/.test(normalized)) {
    return false;
  }

  if (shouldSearchProducts(latestUserMessage)) {
    return true;
  }

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = compact ? compact.split(" ").filter(Boolean) : [];
  if (compact.length > 40 || words.length > 6) {
    return false;
  }

  if (!buildProductSearchCandidates(latestUserMessage).length) {
    return false;
  }

  const previousMessages = history.slice(-4, -1).map((item) => normalizeText(item.content));
  const previousHadCatalogIntent = previousMessages.some((item) =>
    item.includes("na loja") ||
    item.includes("produto") ||
    item.includes("opcoes parecidas") ||
    item.includes("buscar mais opcoes") ||
    item.includes("outro nome") ||
    item.includes("modelo parecido") ||
    item.includes("nao encontrei resultados")
  );

  return previousHadCatalogIntent || Boolean(context?.catalogo?.ultimaBusca);
}

function extractProductSearchTerm(message: string) {
  const cleaned = message
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/^(oi|ola|olá|opa)\s*[!,.-]?\s*/i, "")
    .replace(/^(voces?|você|vc)\s+/i, "")
    .replace(/^e\s+/i, "")
    .replace(/^(tem|tem ai|tem aí|vende|procuro|quero|estou procurando)\s+/i, "")
    .replace(/^(algum|alguma|alguns|algumas)\s+/i, "")
    .replace(/^(produto|produtos|item|itens)\s+(de\s+)?/i, "")
    .replace(/^(no|na|da|do)\s+/i, "")
    .trim();

  return cleaned || message.trim();
}

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "esse",
  "essa",
  "esses",
  "essas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  "isto",
  "isso",
  "aquilo",
  "bem",
  "muito",
  "mais",
  "menos",
  "para",
  "pra",
  "com",
  "sem",
  "que",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "uns",
  "umas",
  "e",
  "eh",
  "bonita",
  "bonito",
  "linda",
  "lindo",
  "gostei",
  "quero",
  "procuro",
  "buscar",
  "busca",
  "produto",
  "produtos",
  "item",
  "itens",
  "esse",
  "desse",
  "dessa",
]);

function buildProductSearchCandidates(message: string) {
  const baseTerm = extractProductSearchTerm(message);
  const normalized = normalizeText(baseTerm).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !PRODUCT_SEARCH_STOPWORDS.has(token));
  const candidates = new Set<string>();

  if (tokens.length) {
    candidates.add(tokens.join(" "));
    candidates.add(tokens.slice(-2).join(" "));
    candidates.add(tokens.slice(0, 2).join(" "));
  }

  [...tokens].reverse().forEach((token) => {
    if (token.length >= 4) {
      candidates.add(token);
    }
  });

  if (baseTerm.trim()) {
    candidates.add(baseTerm.trim());
  }

  if (normalized && normalized !== baseTerm.trim()) {
    candidates.add(normalized);
  }

  return [...candidates].map((term) => term.trim()).filter(Boolean).slice(0, 6);
}

function didAssistantRecentlyAskForLeadName(history: ConversationMessage[]) {
  const previousAssistantMessage = [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";
  const normalized = normalizeText(previousAssistantMessage);

  return (
    normalized.includes("como posso te chamar") ||
    normalized.includes("qual e o seu nome") ||
    normalized.includes("qual e seu nome") ||
    normalized.includes("me diga seu nome") ||
    normalized.includes("qual seu nome") ||
    normalized.includes("primeiro nome") ||
    (normalized.includes("nome") && /\b(qual|diga|informe|passa)\b/.test(normalized))
  );
}

function isLikelyLeadNameReply(message: string, history: ConversationMessage[]) {
  if (!didAssistantRecentlyAskForLeadName(history)) {
    return false;
  }

  const extractedName = extractName(message);
  if (!extractedName) {
    return false;
  }

  const normalized = normalizeText(message);
  if (
    /\b(produto|produtos|modelo|marca|cor|tamanho|sku|loja|mercado livre|ml|catalogo)\b/.test(normalized)
  ) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3;
}

function buildLeadNameAcknowledgementReply(name: string, hasMercadoLivreConnector: boolean, context?: ConversationContext) {
  const safeName = name.trim();
  if (hasMercadoLivreConnector) {
    return isWhatsAppChannel(context)
      ? `Prazer, ${safeName}.\n\nMe diga agora qual produto, modelo, marca, cor ou SKU voce quer buscar na loja.`
      : `Prazer, **${safeName}**.\n\nMe diga agora qual produto, modelo, marca, cor ou SKU voce quer buscar na loja.`;
  }

  return isWhatsAppChannel(context)
    ? `Prazer, ${safeName}.\n\nPode me dizer o que voce quer validar?`
    : `Prazer, **${safeName}**.\n\nPode me dizer o que voce quer validar?`;
}

function isMercadoLivreListingIntent(message: string) {
  const normalized = normalizeText(message);
  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (!compact) {
    return false;
  }

  if (
    ["produtos", "produto", "catalogo", "catálogo", "loja", "vitrine", "anuncios", "anúncios", "itens"].includes(compact)
  ) {
    return true;
  }

  const explicitPatterns = [
    /\bquais produtos\b/,
    /\bquais sao os produtos\b/,
    /\bmostra(?:r|i|e)? os produtos\b/,
    /\bmostra(?:r|i|e)? seus produtos\b/,
    /\bme mostra(?:r|i|e)? os produtos\b/,
    /\bme mostra(?:r|i|e)? seus produtos\b/,
    /\btraga os produtos\b/,
    /\btraga seus produtos\b/,
    /\bme traga seus produtos\b/,
    /\bexiba os produtos\b/,
    /\bexiba seus produtos\b/,
    /\bexibe os produtos\b/,
    /\bexibe seus produtos\b/,
    /\blistar produtos\b/,
    /\blista de produtos\b/,
    /\bliste os produtos\b/,
    /\bliste seus produtos\b/,
    /\bo que voce tem\b/,
    /\bo que vc tem\b/,
    /\bo que voce vende\b/,
    /\bo que vc vende\b/,
    /\bprodutos que voce tem\b/,
    /\bprodutos que vc tem\b/,
    /\bme mostra a loja\b/,
    /\bmostra a loja\b/,
    /\bver catalogo\b/,
    /\bver produtos\b/,
    /\bme passa seu catalogo\b/,
    /\bmanda seu catalogo\b/,
    /\bme envia seu catalogo\b/,
    /\bquero ver seus produtos\b/,
    /\bquero ver os produtos\b/,
    /\bquais itens voce tem\b/,
    /\bquais itens vc tem\b/,
    /\bquais anuncios voce tem\b/,
    /\bquais anuncios vc tem\b/,
  ];

  if (explicitPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const browseVerb = /\b(mostra|mostrar|mostre|exiba|exibe|exibir|liste|listar|lista|traga|trazer|manda|mandar|envia|enviar|ver|veja|quero ver|apresenta|apresentar)\b/;
  const catalogNoun = /\b(produto|produtos|item|itens|catalogo|catálogo|loja|vitrine|anuncio|anuncios|anúncio|anúncios)\b/;

  return browseVerb.test(normalized) && catalogNoun.test(normalized);
}

function shouldUseMercadoLivreConnectorFallback(
  history: ConversationMessage[],
  latestUserMessage: string,
  context?: ConversationContext,
) {
  const normalized = normalizeText(latestUserMessage).trim();
  if (!normalized) {
    return false;
  }

  if (isLikelyLeadNameReply(latestUserMessage, history)) {
    return false;
  }

  if (
    /^(oi|ola|opa|bom dia|boa tarde|boa noite|obrigado|obrigada|valeu|blz|beleza|tudo bem)\b/.test(normalized)
  ) {
    return false;
  }

  if (
    /\b(preco|valor|orcamento|quanto|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp|api|status|codigo|consulta)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  if (shouldSearchProducts(latestUserMessage)) {
    return true;
  }

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = compact ? compact.split(" ").filter(Boolean) : [];
  if (!words.length || compact.length > 60 || words.length > 8) {
    return false;
  }

  if (!buildProductSearchCandidates(latestUserMessage).length) {
    return false;
  }

  if (Boolean(context?.catalogo?.ultimaBusca)) {
    return true;
  }

  return words.some((word) => word.length >= 3 || /\d/.test(word));
}

function buildMercadoLivreListingReply(produtos: ProdutoPadronizado[], context?: ConversationContext) {
  if (!produtos.length) {
    return isWhatsAppChannel(context)
      ? "Nao encontrei produtos visiveis na loja neste momento."
      : "Nao encontrei produtos visiveis na loja neste momento.";
  }

  return isWhatsAppChannel(context)
    ? 'Separei alguns produtos da loja para voce logo abaixo. Se quiser ver mais opcoes, me responda "mais".'
    : "Separei alguns produtos da loja logo abaixo. Se quiser, eu tambem posso buscar um modelo especifico.";
}

function buildMercadoLivreNoResultsReply(termo: string, context?: ConversationContext, options?: { exhausted?: boolean }) {
  const termoLimpo = termo.trim() || "esse produto";

  if (options?.exhausted) {
    return isWhatsAppChannel(context)
      ? 'Ja te mostrei as opcoes mais relevantes que encontrei por agora. Se quiser, me diga outro nome, cor, tamanho ou modelo para eu buscar uma nova leva.'
      : 'Ja mostrei as opcoes mais relevantes encontradas ate aqui. Se quiser, me diga outro nome, cor, tamanho ou modelo para eu fazer uma nova busca.';
  }

  if (isWhatsAppChannel(context)) {
    return [
      `Nao encontrei resultados para "${termoLimpo}" na loja agora.`,
      "Se quiser, eu posso tentar com outro nome, cor, tamanho ou modelo parecido.",
    ].join("\n\n");
  }

  return [
    `Nao encontrei resultados para **"${termoLimpo}"** na loja neste momento.`,
    "",
    "Se quiser, eu posso tentar outra busca com um nome parecido, cor, tamanho ou modelo alternativo.",
  ].join("\n");
}

function normalizeRecentCatalogProducts(context?: ConversationContext): CatalogProductReference[] {
  if (!Array.isArray(context?.catalogo?.ultimosProdutos)) {
    return [];
  }

  return context.catalogo.ultimosProdutos
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      nome: typeof item.nome === "string" ? item.nome : null,
      descricao: typeof item.descricao === "string" ? item.descricao : null,
      preco: typeof item.preco === "number" && Number.isFinite(item.preco) ? item.preco : null,
      link: typeof item.link === "string" ? item.link : null,
      imagem: typeof item.imagem === "string" ? item.imagem : null,
    }))
    .filter((item) => item.nome);
}

function isCatalogLoadMoreIntent(message: string, context?: ConversationContext) {
  const normalized = normalizeText(message);
  if (!normalized || !normalizeRecentCatalogProducts(context).length) {
    return false;
  }

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }

  if (["mais", "outras", "outros", "mais opcoes", "outras opcoes", "mais modelos", "outros modelos"].includes(compact)) {
    return true;
  }

  return [
    /\btem mais\b/,
    /\bquero mais\b/,
    /\bme mostra mais\b/,
    /\bmostra mais\b/,
    /\btraz mais\b/,
    /\bmanda mais\b/,
    /\bver mais\b/,
    /\boutras opcoes\b/,
    /\boutros modelos\b/,
    /\bmais modelos\b/,
    /\bmais opcoes\b/,
  ].some((pattern) => pattern.test(normalized));
}

function tokenizeCatalogReferenceMessage(message: string) {
  return normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "esse",
          "essa",
          "esses",
          "essas",
          "aquele",
          "aquela",
          "aquilo",
          "produto",
          "produtos",
          "item",
          "itens",
          "bonita",
          "bonito",
          "lindo",
          "linda",
          "quero",
          "gostei",
          "desse",
          "dessa",
          "dele",
          "dela",
        ].includes(token),
    );
}

function resolveRecentCatalogProductReference(message: string, context?: ConversationContext) {
  const products = normalizeRecentCatalogProducts(context);
  if (!products.length) {
    return [];
  }

  const normalized = normalizeText(message);
  const ordinalMatchers = [
    { pattern: /\b(primeiro|1|um)\b/, index: 0 },
    { pattern: /\b(segundo|2|dois)\b/, index: 1 },
    { pattern: /\b(terceiro|3|tres|três)\b/, index: 2 },
    { pattern: /\b(quarto|4|quatro)\b/, index: 3 },
    { pattern: /\b(quinto|5|cinco)\b/, index: 4 },
    { pattern: /\b(ultimo|último)\b/, index: products.length - 1 },
  ];

  for (const matcher of ordinalMatchers) {
    if (matcher.index >= 0 && matcher.index < products.length && matcher.pattern.test(normalized)) {
      return [products[matcher.index]];
    }
  }

  if (/\b(mais caro)\b/.test(normalized)) {
    return [...products]
      .filter((item) => typeof item.preco === "number")
      .sort((a, b) => Number(b.preco ?? 0) - Number(a.preco ?? 0))
      .slice(0, 1);
  }

  if (/\b(mais barato)\b/.test(normalized)) {
    return [...products]
      .filter((item) => typeof item.preco === "number")
      .sort((a, b) => Number(a.preco ?? 0) - Number(b.preco ?? 0))
      .slice(0, 1);
  }

  const priceMatch = normalized.match(/\b(?:r\$?\s*)?(\d{2,6})(?:[.,]\d{1,2})?\b/);
  if (priceMatch) {
    const price = Number(priceMatch[1]);
    const byPrice = products.filter((item) => Number(item.preco ?? NaN) === price);
    if (byPrice.length) {
      return byPrice.slice(0, 2);
    }
  }

  const tokens = tokenizeCatalogReferenceMessage(message);
  if (!tokens.length) {
    return [];
  }

  const scored = products
    .map((item) => {
      const haystack = normalizeText([item.nome, item.descricao].filter(Boolean).join(" "));
      const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + 1 : total), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return [];
  }

  const topScore = scored[0]?.score ?? 0;
  return scored.filter((entry) => entry.score === topScore).slice(0, 2).map((entry) => entry.item);
}

function isRecentCatalogReferenceAttempt(message: string, context?: ConversationContext) {
  const products = normalizeRecentCatalogProducts(context);
  if (!products.length) {
    return false;
  }

  const normalized = normalizeText(message);
  return /\b(esse|essa|esses|essas|aquele|aquela|aqueles|aquelas|primeiro|segundo|terceiro|ultimo|último|mais caro|mais barato)\b/.test(
    normalized,
  );
}

function buildReferencedCatalogReply(products: CatalogProductReference[], context?: ConversationContext) {
  if (!products.length) {
    return null;
  }

  if (products.length === 1) {
    const product = products[0];
    const priceLabel = typeof product.preco === "number" ? `R$ ${product.preco.toLocaleString("pt-BR")}` : product.descricao ?? "";

    return isWhatsAppChannel(context)
      ? `Acredito que voce esteja falando de ${product.nome}${priceLabel ? `, por ${priceLabel}` : ""}. Se quiser, eu posso te mostrar mais detalhes ou buscar opcoes parecidas.`
      : `Acredito que voce esteja falando de **${product.nome}**${priceLabel ? `, por **${priceLabel}**` : ""}. Se quiser, eu posso te mostrar mais detalhes ou buscar opcoes parecidas.`;
  }

  return isWhatsAppChannel(context)
    ? "Acredito que voce esteja falando de uma destas opcoes logo abaixo. Se quiser, me diga o numero do card ou o preco para eu cravar qual delas."
    : "Acredito que voce esteja falando de uma destas opcoes logo abaixo. Se quiser, me diga o **numero do card** ou o **preco** para eu cravar qual delas.";
}

function buildAmbiguousCatalogReferenceReply(context?: ConversationContext) {
  return isWhatsAppChannel(context)
    ? "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o numero do card ou o preco para eu identificar certinho."
    : "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o **numero do card** ou o **preco** para eu identificar certinho.";
}

function buildReferencedCatalogAssets(products: CatalogProductReference[]): ReplyAsset[] {
  return products
    .filter((item) => item.nome && item.imagem)
    .slice(0, 2)
    .map((item, index) => ({
      id: item.id || `catalog-ref-${index + 1}`,
      nome: String(item.nome),
      descricao:
        typeof item.preco === "number"
          ? `R$ ${item.preco.toLocaleString("pt-BR")}`
          : String(item.descricao || ""),
      arquivoNome: String(item.nome),
      mimeType: "image/jpeg",
      categoria: "image",
      publicUrl: String(item.imagem),
      targetUrl: item.link || null,
    }));
}

function isMercadoLivrePurchaseIntent(message: string) {
  const normalized = normalizeText(message);
  return /\b(gostei|quero|comprar|levar|fechar|pedido|interesse|tenho interesse|vou querer|separa|reservar|manda o link|me passa o link)\b/.test(
    normalized,
  );
}

function isMercadoLivreDetailIntent(message: string) {
  const normalized = normalizeText(message);
  return /\b(detalhe|detalhes|descricao|descrição|garantia|material|medida|medidas|tamanho|capacidade|cor|estoque|frete|entrega|condicao|condição|vendeu|vendidos)\b/.test(
    normalized,
  );
}

function formatMercadoLivreCondition(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  if (normalized === "new") {
    return "novo";
  }
  if (normalized === "used") {
    return "usado";
  }
  return value?.trim() || null;
}

function buildMercadoLivreDetailPromptContext(produto: ProdutoDetalhadoMercadoLivre | null) {
  if (!produto) {
    return "";
  }

  const atributos = (produto.atributos ?? []).map((item) => `- ${item.nome}: ${item.valor}`);
  return [
    "Produto atual em foco no Mercado Livre:",
    `- id: ${produto.id ?? ""}`,
    `- nome: ${produto.nome}`,
    `- preco: ${produto.preco}`,
    produto.condicao ? `- condicao: ${produto.condicao}` : "",
    produto.garantia ? `- garantia: ${produto.garantia}` : "",
    typeof produto.estoque === "number" ? `- estoque: ${produto.estoque}` : "",
    typeof produto.vendidos === "number" ? `- vendidos: ${produto.vendidos}` : "",
    typeof produto.freteGratis === "boolean" ? `- frete_gratis: ${produto.freteGratis ? "sim" : "nao"}` : "",
    produto.descricao ? `- descricao: ${produto.descricao}` : "",
    ...atributos,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMercadoLivreSalesReply(
  produto: ProdutoDetalhadoMercadoLivre,
  latestUserMessage: string,
  context?: ConversationContext,
  cta?: string | null,
) {
  const normalized = normalizeText(latestUserMessage);

  if (/\bgarantia\b/.test(normalized)) {
    const garantia = produto.garantia?.trim() || "Nao encontrei garantia informada no anuncio";
    return isWhatsAppChannel(context)
      ? `${produto.nome}: ${garantia}.\n\nSe quiser, eu tambem posso te dizer condicao, estoque e frete para voce decidir melhor.`
      : `**${produto.nome}**: ${garantia}.\n\nSe quiser, eu tambem posso te dizer **condicao, estoque e frete** para voce decidir melhor.`;
  }

  if (/\bfrete\b|\bentrega\b/.test(normalized)) {
    const frete =
      typeof produto.freteGratis === "boolean"
        ? produto.freteGratis
          ? "O anuncio indica frete gratis."
          : "O anuncio nao indica frete gratis."
        : "Nao encontrei frete detalhado no anuncio.";
    return [frete, cta?.trim() || "Se quiser, eu sigo com voce e vejo se vale a pena fechar este item ou comparar com outro parecido."].join("\n\n");
  }

  if (/\bestoque\b|\bdisponivel\b/.test(normalized)) {
    const estoque =
      typeof produto.estoque === "number"
        ? `No anuncio aparecem ${produto.estoque} unidade(s) disponivel(is).`
        : "Nao encontrei estoque detalhado no anuncio.";
    return [estoque, cta?.trim() || "Se quiser, eu sigo com voce e te ajudo a decidir se vale fechar este item agora."].join("\n\n");
  }

  if (/\bmaterial\b|\bmedida\b|\bmedidas\b|\btamanho\b|\bcapacidade\b|\bcor\b/.test(normalized)) {
    const matchingAttributes = (produto.atributos ?? []).filter((item) =>
      /\b(material|medida|medidas|tamanho|capacidade|cor)\b/.test(normalizeText(item.nome)),
    );
    if (matchingAttributes.length) {
      const summary = matchingAttributes.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`).join(" | ");
      return [`Encontrei estes detalhes no anuncio: ${summary}.`, cta?.trim() || "Se quiser, eu tambem posso te falar de garantia, estoque e frete antes de voce decidir."].join("\n\n");
    }
  }

  const highlights: string[] = [];
  if (produto.atributos?.length) {
    highlights.push(...produto.atributos.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`));
  }
  const condition = formatMercadoLivreCondition(produto.condicao);
  if (condition) {
    highlights.push(`Condicao: ${condition}`);
  }
  if (produto.garantia) {
    highlights.push(`Garantia: ${produto.garantia}`);
  }
  if (typeof produto.freteGratis === "boolean") {
    highlights.push(produto.freteGratis ? "Frete gratis" : "Frete a consultar");
  }
  if (typeof produto.vendidos === "number" && produto.vendidos > 0) {
    highlights.push(`${produto.vendidos} vendas`);
  }

  const leadIn = isWhatsAppChannel(context)
    ? `Boa escolha. ${produto.nome} esta por R$ ${produto.preco.toLocaleString("pt-BR")}.`
    : `**Boa escolha.** ${produto.nome} esta por **R$ ${produto.preco.toLocaleString("pt-BR")}**.`;
  const sellingPoint = highlights.length
    ? `Pelo anuncio, os pontos que mais ajudam na decisao sao: ${highlights.join(" | ")}.`
    : produto.descricao
      ? produto.descricao
      : "Posso te detalhar melhor esse item e te ajudar a decidir com mais seguranca.";
  const close = cta?.trim()
    ? cta.trim()
    : "Se fizer sentido para voce, me diga se quer seguir com este item ou comparar com outra opcao parecida.";

  return [leadIn, sellingPoint, close].filter(Boolean).join("\n\n");
}

function getCatalogProductRefForDetails(product: CatalogProductReference | null | undefined) {
  if (!product) {
    return null;
  }

  if (typeof product.id === "string" && /^MLB\d+$/i.test(product.id.trim())) {
    return product.id.trim();
  }

  if (typeof product.link === "string" && product.link.trim()) {
    return product.link.trim();
  }

  return typeof product.id === "string" && product.id.trim() ? product.id.trim() : null;
}

function buildMercadoLivreProductAssets(produtos: ProdutoPadronizado[]): ReplyAsset[] {
  return produtos.slice(0, 3).map((produto, index) => ({
    id: produto.id || `mercado-livre-${index + 1}-${normalizeText(produto.nome).replace(/\s+/g, "-") || "produto"}`,
    nome: produto.nome,
    descricao: `R$ ${produto.preco.toLocaleString("pt-BR")}`,
    arquivoNome: produto.nome,
    mimeType: "image/jpeg",
    categoria: "image",
    publicUrl: produto.imagem,
    targetUrl: produto.link,
  }));
}

function buildMercadoLivreReply(produtos: ProdutoPadronizado[], context?: ConversationContext) {
  if (!produtos.length) {
    return null;
  }

  if (produtos.length === 1) {
    return isWhatsAppChannel(context)
      ? 'Encontrei um produto da loja para voce logo abaixo. Se quiser ver outras opcoes parecidas, me responda "mais".'
      : "Encontrei um produto da loja logo abaixo. Se quiser, eu posso buscar outras opcoes parecidas.";
  }

  return isWhatsAppChannel(context)
    ? 'Encontrei algumas opcoes parecidas na loja logo abaixo. Se quiser ver outras sem repetir estas, me responda "mais".'
    : "Encontrei algumas opcoes parecidas na loja logo abaixo. Se quiser, eu posso buscar mais variacoes desse produto.";
}

function buildMercadoLivrePromptContext(produtos: ProdutoPadronizado[]) {
  if (!produtos.length) {
    return "";
  }

  return [
    "Produtos encontrados no conector Mercado Livre do agente:",
    ...produtos.map((produto) => `- nome: ${produto.nome} | preco: ${produto.preco} | link: ${produto.link}`),
    "Se o cliente estiver buscando produto, responda com base nesses itens e convide para refinar a busca se necessario.",
  ].join("\n");
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
  precoLabel: string;
};

function detectCatalogItems(history: ConversationMessage[]) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => normalizeText(item.content))
    .join(" ");

  const items: CatalogItem[] = [];
  const has = (pattern: RegExp) => pattern.test(userText);
  const asksForChat = has(
    /\bchat\b|\bwidget\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b|\bchat no site\b|\bchat no sistema\b|\bchat em sistema\b|\bchat em um sistema\b|\bsistema legado\b|\bsite legado\b|\badicionar o chat\b|\bcolocar o chat\b|\bimplantar o chat\b/,
  );
  const asksForStandaloneSystem = !asksForChat &&
    has(/\bsistema\b|\bpainel\b|\bcadastro\b|\bproduto\b|\bprodutos\b|\badmin\b|\badm\b|\blistagem\b|\bcatalogo\b/);

  if (has(/\bsite\b|\blanding page\b|\bpagina\b/) && !asksForChat) {
    items.push({ slug: "site-comum", nome: "Criacao de site", precoLabel: "R$300 a R$1000" });
  }

  if (asksForChat) {
    items.push({ slug: "chat-ia", nome: "Chat com IA (widget)", precoLabel: "R$50 de adesao + R$20/mês" });
  }

  if (has(/\bwhatsapp\b|\bautomatiza(?:r|cao) whatsapp\b|\batendimento no whatsapp\b/)) {
    items.push({ slug: "automacao-whatsapp", nome: "Atendimento com agentes no WhatsApp", precoLabel: "A partir de R$200/mês" });
  }

  if (has(/\bcrm\b|\bintegrac(?:ao|a)o com crm\b/)) {
    items.push({ slug: "integracao-crm", nome: "Integracao/API", precoLabel: "R$400 a R$1000" });
  }

  if (asksForStandaloneSystem) {
    items.push({ slug: "sistema-sob-medida-simples", nome: "Sistema com IA", precoLabel: "R$500 a R$2000" });
  }

  return items.filter((item, index, array) => array.findIndex((entry) => entry.slug === item.slug) === index);
}

function isOutOfScopeForCatalog(history: ConversationMessage[]) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => normalizeText(item.content))
    .join(" ");
  const asksForChat = /\bchat\b|\bwidget\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b|\bchat no site\b|\bchat no sistema\b|\bchat em sistema\b|\bchat em um sistema\b|\bsistema legado\b|\bsite legado\b|\badicionar o chat\b|\bcolocar o chat\b|\bimplantar o chat\b/.test(
    userText,
  );

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
  return catalogItems.length === 0 || (!asksForChat && complexSignals.some((pattern) => pattern.test(userText)));
}

function buildCatalogPricingReply(history: ConversationMessage[], context?: ConversationContext) {
  const catalogItems = detectCatalogItems(history);
  if (catalogItems.length === 0 || isOutOfScopeForCatalog(history)) {
    return null;
  }

  const labels = catalogItems.map((item) => `${item.nome}: ${item.precoLabel}`);
  const joinedLabels = labels.join(" + ");

  if (catalogItems.length === 1) {
    return prefersStructuredReply(context)
      ? [
          "✓ **Melhor encaixe inicial**",
          labels[0],
          "",
          "→ Se quiser, eu sigo com voce por aqui e ja te explico como isso entra no seu caso, ou te encaminho no WhatsApp para fecharmos mais rapido.",
        ].join("\n")
      : `Pelo que voce descreveu, isso encaixa em ${joinedLabels}. Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo.`;
  }

  return prefersStructuredReply(context)
    ? [
        "✓ **Melhor encaixe inicial**",
        ...labels.map((label) => `- ${label}`),
        "",
        "→ Se quiser, eu posso te dizer qual combinacao faz mais sentido para o seu caso e te direcionar no WhatsApp para alinharmos os detalhes finais.",
      ].join("\n")
    : `Pelo que voce descreveu, isso encaixa no nosso catalogo como ${joinedLabels}. Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais.`;
}

function maybeAskForLeadIdentification(context: ConversationContext, history: ConversationMessage[], latestUserMessage: string) {
  const count = context.memoria?.mensagem_count ?? 0;
  const hasName = Boolean(context.lead?.nome?.trim());
  const identified = Boolean(context.lead?.identificado);
  const ready = Boolean(context.qualificacao?.pronto_para_whatsapp);
  const normalized = normalizeText(latestUserMessage);

  if (hasName || identified) {
    return null;
  }

  if (!isOutOfScopeForCatalog(history)) {
    return null;
  }

  if (count <= 2) {
    return isWhatsAppChannel(context)
      ? "Perfeito. Antes de seguir, qual e o seu nome?"
      : "Antes de eu te orientar melhor, como posso te chamar?";
  }

  if (ready || count >= 4 || normalized.includes("orcamento") || normalized.includes("whatsapp")) {
    return "Consigo seguir com voce por aqui, mas para te direcionar melhor no WhatsApp me envie seu nome e telefone com DDD.";
  }

  return null;
}

export async function generateSalesReply(history: ConversationMessage[], context?: ConversationContext) {
  const latestUserMessage = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const detectedProductSearch = shouldContinueProductSearch(history, latestUserMessage, context);
  const channelPolicy = getChatChannelPolicy(context);
  const enableInfraStudioHeuristics = isInfraStudioFirstPartyContext(context);
  const projectId = context?.admin?.projetoId ?? context?.projeto?.id ?? null;
  const agentId = context?.admin?.agenteId ?? context?.agente?.id ?? null;
  const lockedToAgent = context?.agente?.locked === true;
  const resolvedAgent = agentId ? await getAgenteById(agentId) : null;
  const agent =
    resolvedAgent && resolvedAgent.ativo && (!projectId || resolvedAgent.projetoId === projectId) ? resolvedAgent : null;

  const traceBase = {
    projetoId: projectId,
    agenteId: agent?.id ?? agentId ?? null,
    payload: {
      lockedToAgent,
      resolvedAgentId: resolvedAgent?.id ?? null,
      resolvedAgentProjetoId: resolvedAgent?.projetoId ?? null,
      resolvedAgentAtivo: resolvedAgent?.ativo ?? null,
      channelKind: context?.channel?.kind ?? null,
      latestUserMessage: latestUserMessage.slice(0, 280),
    },
  };

  if (!agent) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.guardrail",
      message: lockedToAgent ? "Agente travado invalido ou inativo no orquestrador." : "Orquestrador sem agente valido. Fallback automatico bloqueado.",
      ...traceBase,
    });
    return {
      reply: "",
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "guardrail",
        model: "inactive_or_invalid_agent",
        agenteId: null,
        agenteNome: null,
      },
    };
  }
  const runtimeAssets = buildRuntimeReplyAssets(agent?.arquivos ?? []);
  const apiContexts = agent?.id ? await buildAgenteApiRuntimeContext(agent.id, (context ?? {}) as Record<string, unknown>) : [];
  const mercadoLivreConnectors = agent?.id ? await listConectoresByAgente(agent.id, MERCADO_LIVRE_CONNECTOR_TYPE) : [];
  const hasMercadoLivreConnector = mercadoLivreConnectors.length > 0;
  const leadNameReplyDetected = isLikelyLeadNameReply(latestUserMessage, history);
  const extractedLeadName = leadNameReplyDetected ? extractName(latestUserMessage) : null;
  const recentCatalogProducts = normalizeRecentCatalogProducts(context);
  const loadMoreCatalogRequested = hasMercadoLivreConnector && !leadNameReplyDetected && isCatalogLoadMoreIntent(latestUserMessage, context);
  const previousCatalogSearchTerm = typeof context?.catalogo?.ultimaBusca === "string" ? context.catalogo.ultimaBusca.trim() : "";
  const genericMercadoLivreListingRequested =
    hasMercadoLivreConnector && isMercadoLivreListingIntent(latestUserMessage) && !leadNameReplyDetected && !loadMoreCatalogRequested;
  const productSearchRequested =
    !genericMercadoLivreListingRequested &&
    !leadNameReplyDetected &&
    (loadMoreCatalogRequested ||
      detectedProductSearch ||
      (hasMercadoLivreConnector && shouldUseMercadoLivreConnectorFallback(history, latestUserMessage, context)));
  const productSearchSeed = loadMoreCatalogRequested ? previousCatalogSearchTerm : latestUserMessage;
  const productSearchCandidates = productSearchRequested ? buildProductSearchCandidates(productSearchSeed) : [];
  const productSearchTerm = productSearchCandidates[0] ?? "";
  const mercadoLivreListingSnapshot =
    agent?.id && genericMercadoLivreListingRequested ? await listarProdutosRecentesMercadoLivrePorAgente(agent.id) : null;
  const mercadoLivreListingProducts = mercadoLivreListingSnapshot?.produtos ?? [];
  let mercadoLivreProducts: ProdutoPadronizado[] = [];
  let resolvedProductSearchTerm = productSearchTerm;

  if (agent?.id && productSearchRequested && hasMercadoLivreConnector) {
    const excludedProductRefs = loadMoreCatalogRequested
      ? recentCatalogProducts
          .flatMap((item) => [typeof item.id === "string" ? item.id : null, typeof item.link === "string" ? item.link : null])
          .filter((item): item is string => Boolean(item))
      : [];
    for (const candidate of productSearchCandidates) {
      const currentProducts = await buscarProdutosMercadoLivrePorAgente(agent.id, candidate, {
        excludeRefs: excludedProductRefs,
        limit: 3,
      });
      if (currentProducts.length) {
        mercadoLivreProducts = currentProducts;
        resolvedProductSearchTerm = candidate;
        break;
      }
    }
  }
  const resourceTrace = {
    apiNames: apiContexts.map((item) => item.nome),
    apiErrors: apiContexts.filter((item) => item.erro).map((item) => ({ nome: item.nome, erro: item.erro })),
    mercadoLivreRequested: productSearchRequested,
    mercadoLivreLoadMoreRequested: loadMoreCatalogRequested,
    mercadoLivreConnectorActive: hasMercadoLivreConnector,
    mercadoLivreListingRequested: genericMercadoLivreListingRequested,
    mercadoLivreTerm: resolvedProductSearchTerm || null,
    mercadoLivreCandidates: productSearchCandidates,
    mercadoLivreListingCount: mercadoLivreListingProducts.length,
    mercadoLivreCount: mercadoLivreProducts.length,
  };
  const openai = await getProjetoOpenAIConfig(projectId);
  const systemPrompt = buildSystemPrompt(agent, context, hasMercadoLivreConnector);
  const channelReplyInstruction = buildChannelReplyInstruction(context);
  const runtimePrompt = buildRuntimePrompt(agent, latestUserMessage, context, apiContexts);
  const legacyAgentPrompt = buildLegacyAgentPrompt(agent);
  const structuredReplyInstruction = buildStructuredReplyInstruction(context);
  const analyticalReplyInstruction = buildAnalyticalReplyInstruction(latestUserMessage);
  const agentAssetInstruction = buildAgentAssetInstruction(runtimeAssets, latestUserMessage);
  const focusedApiContext = buildFocusedApiContext(latestUserMessage, apiContexts);
  const scopedRecoveryReply = buildAgentScopedRecoveryReply({
    message: latestUserMessage,
    context,
    agent,
    apiContexts,
    hasMercadoLivreConnector,
  });
  const catalogPricingReply = enableInfraStudioHeuristics ? buildCatalogPricingReply(history, context) : null;
  const leadIdentificationReply = enableInfraStudioHeuristics && channelPolicy.allowLeadGate ? maybeAskForLeadIdentification(context ?? {}, history, latestUserMessage) : null;
  const leadNameAcknowledgementReply =
    extractedLeadName ? buildLeadNameAcknowledgementReply(extractedLeadName, hasMercadoLivreConnector, context) : null;
  const referencedCatalogProducts =
    hasMercadoLivreConnector && !leadNameReplyDetected && !productSearchRequested && !genericMercadoLivreListingRequested
      ? resolveRecentCatalogProductReference(latestUserMessage, context)
      : [];
  const referencedCatalogReply = buildReferencedCatalogReply(referencedCatalogProducts, context);
  const currentCatalogProduct =
    !productSearchRequested && context?.catalogo?.produtoAtual && typeof context.catalogo.produtoAtual === "object"
      ? context.catalogo.produtoAtual
      : null;
  const selectedCatalogProduct =
    referencedCatalogProducts.length === 1 ? referencedCatalogProducts[0] : currentCatalogProduct;
  const shouldPitchSelectedProduct =
    Boolean(selectedCatalogProduct) &&
    (isMercadoLivrePurchaseIntent(latestUserMessage) || isMercadoLivreDetailIntent(latestUserMessage));
  const selectedCatalogProductDetails =
    shouldPitchSelectedProduct && agent?.id && getCatalogProductRefForDetails(selectedCatalogProduct)
      ? await obterDetalhesProdutoMercadoLivrePorAgente(agent.id, getCatalogProductRefForDetails(selectedCatalogProduct) ?? "")
      : null;
  const lojaCta =
    typeof agent.configuracoes?.cta_whatsapp === "string" && agent.configuracoes.cta_whatsapp.trim()
      ? agent.configuracoes.cta_whatsapp.trim()
      : null;
  const selectedProductSalesReply =
    selectedCatalogProductDetails && shouldPitchSelectedProduct
      ? buildMercadoLivreSalesReply(selectedCatalogProductDetails, latestUserMessage, context, lojaCta)
      : null;
  const ambiguousCatalogReferenceReply =
    hasMercadoLivreConnector &&
    !leadNameReplyDetected &&
    !referencedCatalogReply &&
    isRecentCatalogReferenceAttempt(latestUserMessage, context)
      ? buildAmbiguousCatalogReferenceReply(context)
      : null;
  const mercadoLivreListingReply = genericMercadoLivreListingRequested
    ? buildMercadoLivreListingReply(mercadoLivreListingProducts, context)
    : null;
  const mercadoLivrePromptContext = buildMercadoLivrePromptContext(mercadoLivreProducts);
  const mercadoLivreDetailPromptContext = buildMercadoLivreDetailPromptContext(selectedCatalogProductDetails);
  const directMercadoLivreReply = buildMercadoLivreReply(mercadoLivreProducts, context);
  const mercadoLivreNoResultsReply =
    productSearchRequested && agent?.id && hasMercadoLivreConnector && mercadoLivreProducts.length === 0
      ? buildMercadoLivreNoResultsReply(resolvedProductSearchTerm || productSearchTerm, context, {
          exhausted: loadMoreCatalogRequested,
        })
      : null;

  if (leadIdentificationReply && leadNameReplyDetected) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta de nome do lead priorizada antes do conector Mercado Livre.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "lead_name_priority" },
    });
  }

  if (leadNameAcknowledgementReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Nome do lead reconhecido e confirmado antes de outras heuristicas.",
      ...traceBase,
      payload: {
        ...traceBase.payload,
        ...resourceTrace,
        mode: "lead_name_acknowledgement",
        extractedLeadName,
      },
    });
    return {
      reply: formatHeuristicReply(leadNameAcknowledgementReply, context),
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "lead_name_acknowledgement",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (selectedProductSalesReply && selectedCatalogProductDetails) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta comercial de produto especifico do Mercado Livre acionada.",
      ...traceBase,
      payload: {
        ...traceBase.payload,
        ...resourceTrace,
        mode: "mercado_livre_product_sales",
        productId: selectedCatalogProductDetails.id ?? null,
      },
    });
    return {
      reply: formatHeuristicReply(selectedProductSalesReply, context),
      assets: buildMercadoLivreProductAssets([selectedCatalogProductDetails]),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_product_sales",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
        catalogoProdutoAtual: {
          id: selectedCatalogProductDetails.id ?? null,
          nome: selectedCatalogProductDetails.nome,
          descricao: `R$ ${selectedCatalogProductDetails.preco.toLocaleString("pt-BR")}`,
          preco: selectedCatalogProductDetails.preco,
          link: selectedCatalogProductDetails.link,
          imagem: selectedCatalogProductDetails.imagem,
        },
      },
    };
  }

  if (referencedCatalogReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Referencia aos ultimos produtos do catalogo resolvida pelo contexto.",
      ...traceBase,
      payload: {
        ...traceBase.payload,
        ...resourceTrace,
        mode: "catalog_reference_resolution",
        matchedCount: referencedCatalogProducts.length,
      },
    });
    return {
      reply: formatHeuristicReply(referencedCatalogReply, context),
      assets: buildReferencedCatalogAssets(referencedCatalogProducts),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "catalog_reference_resolution",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
        catalogoProdutoAtual:
          referencedCatalogProducts.length === 1
            ? {
                id: referencedCatalogProducts[0]?.id ?? null,
                nome: referencedCatalogProducts[0]?.nome ?? null,
                descricao: referencedCatalogProducts[0]?.descricao ?? null,
                preco: referencedCatalogProducts[0]?.preco ?? null,
                link: referencedCatalogProducts[0]?.link ?? null,
                imagem: referencedCatalogProducts[0]?.imagem ?? null,
              }
            : null,
      },
    };
  }

  if (ambiguousCatalogReferenceReply) {
    const recentProducts = normalizeRecentCatalogProducts(context);
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Referencia ambigua aos ultimos produtos do catalogo tratada com confirmacao.",
      ...traceBase,
      payload: {
        ...traceBase.payload,
        ...resourceTrace,
        mode: "catalog_reference_ambiguous",
        recentCount: recentProducts.length,
      },
    });
    return {
      reply: formatHeuristicReply(ambiguousCatalogReferenceReply, context),
      assets: buildReferencedCatalogAssets(recentProducts),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "catalog_reference_ambiguous",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (mercadoLivreListingReply) {
    const mercadoLivreAssets = buildMercadoLivreProductAssets(mercadoLivreListingProducts);
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Listagem de produtos recentes do Mercado Livre acionada.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "mercado_livre_listing" },
    });
    return {
      reply: formatHeuristicReply(mercadoLivreListingReply, context),
      assets: mercadoLivreAssets,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_listing",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (directMercadoLivreReply) {
    const mercadoLivreAssets = buildMercadoLivreProductAssets(mercadoLivreProducts);
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta heuristica por conector Mercado Livre acionada.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "mercado_livre_connector" },
    });
    return {
      reply: formatHeuristicReply(directMercadoLivreReply, context),
      assets: mercadoLivreAssets,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_connector",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
        catalogoProdutoAtual:
          mercadoLivreProducts.length === 1
            ? {
                id: mercadoLivreProducts[0]?.id ?? null,
                nome: mercadoLivreProducts[0]?.nome ?? null,
                descricao: `R$ ${mercadoLivreProducts[0]?.preco.toLocaleString("pt-BR")}`,
                preco: mercadoLivreProducts[0]?.preco ?? null,
                link: mercadoLivreProducts[0]?.link ?? null,
                imagem: mercadoLivreProducts[0]?.imagem ?? null,
              }
            : null,
      },
    };
  }

  if (mercadoLivreNoResultsReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Busca em conector Mercado Livre sem resultados.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "mercado_livre_no_results" },
    });
    return {
      reply: formatHeuristicReply(mercadoLivreNoResultsReply, context),
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_no_results",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (catalogPricingReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta heuristica de precificacao do catalogo acionada.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "catalog_pricing" },
    });
    return {
      reply: formatHeuristicReply(catalogPricingReply, context),
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "catalog_pricing",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (leadIdentificationReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta heuristica para identificar nome do lead acionada.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "lead_identification" },
    });
    return {
      reply: formatHeuristicReply(leadIdentificationReply, context),
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "lead_identification",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (!openai.apiKey) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.guardrail",
      message: "OpenAI indisponivel. Resposta bloqueada por fail-closed.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "fail_closed_no_openai_key" },
    });
    return {
      reply: scopedRecoveryReply,
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: { provider: "agent_scoped_recovery", model: "fail_closed_no_openai_key", agenteId: agent?.id ?? null, agenteNome: agent?.nome ?? null },
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
      instructions: [systemPrompt, channelReplyInstruction, runtimePrompt, legacyAgentPrompt, structuredReplyInstruction, analyticalReplyInstruction, agentAssetInstruction, focusedApiContext.instructions, mercadoLivrePromptContext, mercadoLivreDetailPromptContext, summary, lead, qualification]
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
      await appendRuntimeErrorLog({
        source: "chat_orchestrator.guardrail",
        message: "OpenAI retornou erro. Resposta bloqueada por fail-closed.",
        ...traceBase,
        payload: {
          ...traceBase.payload,
          ...resourceTrace,
          mode: "fail_closed_after_openai_error",
          openaiError: payload.error?.message ?? null,
        },
      });
      return {
        reply: scopedRecoveryReply,
        assets: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        metadata: {
          provider: "agent_scoped_recovery",
          model: "fail_closed_after_openai_error",
          agenteId: agent?.id ?? null,
          agenteNome: agent?.nome ?? null,
        },
      };
    }

    const resolvedReply = extractTaggedAssets(outputText, runtimeAssets);
    return {
      reply: resolvedReply.reply,
      assets: resolvedReply.assets,
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
          hasRuntimePrompt: Boolean(runtimePrompt),
          allowIcons: context?.ui?.allow_icons !== false,
          structuredResponse: context?.ui?.structured_response !== false,
          historyLength: history.length,
          requestPayload,
        },
      },
    };
  } catch (error) {
    console.error("[chat] failed to call openai", error);
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.guardrail",
      message: "Excecao ao chamar OpenAI. Resposta bloqueada por fail-closed.",
      ...traceBase,
      payload: {
        ...traceBase.payload,
        ...resourceTrace,
        mode: "fail_closed_after_exception",
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    return {
      reply: scopedRecoveryReply,
      assets: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "agent_scoped_recovery",
        model: "fail_closed_after_exception",
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

  const normalizedOnlyText = message
    .replace(/\+?\d[\d\s().-]{7,}\d/g, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedOnlyText) {
    const lower = normalizeText(normalizedOnlyText);
    const blocked = new Set([
      "quero",
      "preciso",
      "orcamento",
      "site",
      "whatsapp",
      "agenda",
      "sistema",
      "atendimento",
      "integracao",
      "crm",
      "bom dia",
      "boa tarde",
      "boa noite",
      "oi",
      "ola",
      "opa",
      "sim",
      "nao",
    ]);
    const words = normalizedOnlyText.split(/\s+/).filter(Boolean);

    if (
      words.length >= 1 &&
      words.length <= 3 &&
      words.every((word) => word.length >= 2) &&
      !blocked.has(lower) &&
      /^[\p{L}][\p{L}\s'-]+$/u.test(normalizedOnlyText)
    ) {
      const formattedName = words
        .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
        .join(" ");

      if (formattedName.length >= 3) {
        return formattedName;
      }
    }
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
    agente?: { id?: string | null; nome?: string | null; locked?: boolean };
    lead?: { nome?: string | null; telefone?: string | null; email?: string | null; identificado?: boolean };
    memoria?: { resumo?: string | null; mensagem_count?: number; ultimo_resumo_at?: string | null };
    qualificacao?: {
      segmento?: string | null;
      dor_principal?: string | null;
      objetivo?: string | null;
      pronto_para_whatsapp?: boolean;
    };
    catalogo?: {
      ultimaBusca?: string | null;
      produtoAtual?: CatalogProductReference | null;
      ultimosProdutos?: Array<{
        id?: string | null;
        nome?: string | null;
        descricao?: string | null;
        preco?: number | null;
        link?: string | null;
        imagem?: string | null;
      }>;
    };
  };

  const phone = extractPhone(latestUserMessage);
  const name = extractName(latestUserMessage);
  const whatsappContext =
    currentContext && typeof currentContext.whatsapp === "object" && currentContext.whatsapp !== null
      ? (currentContext.whatsapp as { remetente?: string | null })
      : null;
  const channelContext =
    currentContext && typeof currentContext.channel === "object" && currentContext.channel !== null
      ? (currentContext.channel as { kind?: string | null; external_id?: string | null })
      : null;
  const whatsappPhone =
    (typeof whatsappContext?.remetente === "string" ? whatsappContext.remetente : null) ||
    (typeof channelContext?.external_id === "string" ? channelContext.external_id : null);
  const normalizedWhatsappPhone = whatsappPhone ? whatsappPhone.replace(/\D/g, "") : null;
  const isWhatsAppConversation = (channelContext?.kind ?? "").trim().toLowerCase() === "whatsapp";
  const nextCount = history.filter((item) => item.role !== "system").length;
  const resolvedPhone = phone ?? context.lead?.telefone ?? normalizedWhatsappPhone ?? null;
  const resolvedName = name ?? context.lead?.nome ?? null;

  const nextContext = {
    origem: context.origem ?? "site",
    projeto: {
      id: (currentContext as { projeto?: { id?: string | null } } | null)?.projeto?.id ?? null,
      slug: (currentContext as { projeto?: { slug?: string | null } } | null)?.projeto?.slug ?? null,
      nome: (currentContext as { projeto?: { nome?: string | null } } | null)?.projeto?.nome ?? null,
    },
    agente: {
      id: context.agente?.id ?? null,
      nome: context.agente?.nome ?? null,
      locked: context.agente?.locked ?? false,
    },
    lead: {
      nome: resolvedName,
      telefone: resolvedPhone,
      email: context.lead?.email ?? null,
      identificado: isWhatsAppConversation ? Boolean(resolvedPhone) : Boolean(resolvedPhone && resolvedName),
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
    catalogo: {
      ultimaBusca: context.catalogo?.ultimaBusca ?? null,
      produtoAtual: context.catalogo?.produtoAtual ?? null,
      ultimosProdutos: Array.isArray(context.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos : [],
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
    else if (normalized.includes("agenda") || normalized.includes("agendamento")) nextContext.qualificacao.objetivo = "automatizar agenda";
    else if (normalized.includes("venda") || normalized.includes("comercial") || normalized.includes("lead")) nextContext.qualificacao.objetivo = "melhorar operacao comercial";
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
