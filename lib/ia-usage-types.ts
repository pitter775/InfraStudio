export type ChatUsageAggregate = {
  chatId: string;
  titulo: string;
  leadNome: string | null;
  projetoNome: string | null;
  agenteNome: string | null;
  mensagens: number;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  custo: number;
  updatedAt: string;
};

export type AgentUsageAggregate = {
  agenteNome: string;
  chats: number;
  totalTokens: number;
};

export type UsageOriginAggregate = {
  origem: string;
  label: string;
  mensagens: number;
  totalTokens: number;
  custo: number;
};

export type RecentUsageItem = {
  id: string;
  chatId: string;
  titulo: string;
  leadNome: string | null;
  agenteNome: string | null;
  role: string;
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  custo: number;
  origem: string | null;
  origemLabel: string | null;
  provider: string | null;
  routeStage: string | null;
  domainStage: string | null;
  createdAt: string;
};

export type DailyUsagePoint = {
  date: string;
  label: string;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  cost: number;
};

export type IaUsageSummary = {
  periodLabel: string;
  startDate: string;
  endDate: string;
  costModel: string;
  costCurrency: "USD";
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  totalCost: number;
  hasCostData: boolean;
  processedMessages: number;
  activeChats: number;
  activeAgents: number;
  dailyUsage: DailyUsagePoint[];
  topChats: ChatUsageAggregate[];
  topAgents: AgentUsageAggregate[];
  topOrigins: UsageOriginAggregate[];
  recentActivity: RecentUsageItem[];
};

export type TokenUsageGroup = {
  id: string;
  nome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

export type TokenUsageUserProjectGroup = {
  usuarioId: string;
  usuarioNome: string;
  projetoId: string;
  projetoNome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

export type TokenUsageProjectAgent = {
  id: string;
  projetoId: string;
  nome: string;
  ativo: boolean;
};

export type TokenUsageOverview = {
  isAdmin: boolean;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
  totalUsuarios: number;
  totalProjetos: number;
  porUsuario: TokenUsageGroup[];
  porProjeto: TokenUsageGroup[];
  porOrigem: TokenUsageGroup[];
  porUsuarioProjeto: TokenUsageUserProjectGroup[];
  agentesPorProjeto: TokenUsageProjectAgent[];
};
