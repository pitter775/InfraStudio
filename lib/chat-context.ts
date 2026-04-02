import "server-only";

export type CatalogProductReference = {
  id?: string | null;
  nome?: string | null;
  descricao?: string | null;
  preco?: number | null;
  link?: string | null;
  imagem?: string | null;
  cardIndex?: number | null;
};

export type ConversationContext = {
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
    ultimosProdutos?: CatalogProductReference[];
    snapshotId?: string | null;
    snapshotCreatedAt?: string | null;
    snapshotTurnId?: number | null;
  };
};
