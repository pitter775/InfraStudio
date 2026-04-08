import {
  Building2,
  Clock,
  Code2,
  Hammer,
  Headphones,
  Home,
  Instagram,
  MessageSquare,
  Puzzle,
  Share2,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const WHATSAPP_NUMBER = "5511949506267";
export const DEFAULT_CHAT_PROJECT = "infrastudio";
export const DEFAULT_CHAT_AGENT = "default";
export const HOME_CHAT_WIDGET_SLUG = "infrastudio-home";

export const TECH_STACK = [
  "OpenAI",
  "GPT-4o",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Next.js",
  "React",
  "Tailwind CSS",
  "Python",
  "FastAPI",
  "Django",
  "Flask",
  "PostgreSQL",
  "Supabase",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "Vercel",
  "Cloudflare",
  "Stripe",
  "Make",
  "n8n",
  "WhatsApp API",
  "Instagram Graph",
  "LangChain",
  "Webhooks",
  "REST API",
  "GraphQL",
  "Prisma",
  "NestJS",
  "PHP",
  "Laravel",
  "MySQL",
  "Linux",
  "GitHub Actions",
  "CI/CD",
  "Automation",
  "AI Agents",
];

export type ServiceItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
};

export type UseCaseItem = ServiceItem & {
  backgroundImage: string;
  backgroundPosition?: string;
  glowColor: string;
  salesPitch: string;
};

export const SERVICE_ITEMS: ServiceItem[] = [
  {
    icon: Code2,
    title: "Sistemas sob medida",
    description: "Desenvolvimento de softwares exclusivos focados nas necessidades específicas do seu modelo de negócio.",
    delay: 0.1,
  },
  {
    icon: Zap,
    title: "Automação de processos",
    description: "Elimine tarefas repetitivas integrando ferramentas e automatizando fluxos de trabalho complexos.",
    delay: 0.2,
  },
  {
    icon: Share2,
    title: "Integração de APIs",
    description: "Conectamos seu CRM, ERP e sistemas de pagamento para que seus dados fluam sem interrupções.",
    delay: 0.3,
  },
  {
    icon: MessageSquare,
    title: "IA chat para sites",
    description: "Assistentes virtuais inteligentes que entendem o seu produto e respondem clientes 24/7 de forma humana.",
    delay: 0.4,
  },
  {
    icon: Smartphone,
    title: "Automação WhatsApp",
    description: "Sistemas de triagem, agendamento e vendas automáticas diretamente no aplicativo mais usado do país.",
    delay: 0.5,
  },
  {
    icon: Instagram,
    title: "Instagram automation",
    description: "Respostas automáticas no Direct e comentários que transformam seguidores em leads qualificados.",
    delay: 0.6,
  },
];

export const USE_CASE_ITEMS: UseCaseItem[] = [
  {
    icon: Smartphone,
    title: "WhatsApp",
    description:
      "Atenda clientes automaticamente no canal que eles mais usam no dia a dia, com respostas rápidas, continuidade no contexto e menos perda de oportunidade.",
    delay: 0.1,
    backgroundImage: "/bg_whatsapp.png",
    backgroundPosition: "center center",
    glowColor: "rgba(34, 197, 94, 0.28)",
    salesPitch: "Venda, suporte e triagem no mesmo fluxo sem depender de resposta manual.",
  },
  {
    icon: MessageSquare,
    title: "Site",
    description:
      "Responda visitantes em tempo real enquanto eles navegam pela sua página, tirando dúvidas no momento exato em que o lead está pronto para avançar.",
    delay: 0.2,
    backgroundImage: "/bg_site.png",
    backgroundPosition: "center center",
    glowColor: "rgba(59, 130, 246, 0.28)",
    salesPitch: "Transforme tráfego em conversa qualificada sem deixar o visitante esfriar.",
  },
  {
    icon: Puzzle,
    title: "Sistema",
    description:
      "Leve o atendente para dentro do seu fluxo interno ou painel operacional, automatizando consultas, apoio à equipe e execução guiada dentro da operação.",
    delay: 0.3,
    backgroundImage: "/bg_sistema.png",
    backgroundPosition: "center center",
    glowColor: "rgba(168, 85, 247, 0.28)",
    salesPitch: "Mais produtividade para o time e menos gargalo em processos repetitivos.",
  },
  {
    icon: ShoppingBag,
    title: "Loja (Mercado Livre)",
    description:
      "Automatize respostas e ganhe velocidade no atendimento da sua operação, mantendo padrão comercial, agilidade e escala nos contatos da loja.",
    delay: 0.4,
    backgroundImage: "/bg_mercadolivre.png",
    backgroundPosition: "center center",
    glowColor: "rgba(250, 204, 21, 0.18)",
    salesPitch: "Atenda mais rápido, reduza fila e aumente conversão sem aumentar a equipe.",
  },
];

export const DEMO_FEATURES = [
  { title: "IA nativa", desc: "Integração real com modelos GPT para atendimento." },
  { title: "Alta performance", desc: "Carregamento instantâneo e UI intuitiva." },
];

export type BenefitItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

export const BENEFIT_ITEMS: BenefitItem[] = [
  { icon: Zap, title: "Produtividade", desc: "Foque no que importa, deixe a rotina com a gente." },
  { icon: Clock, title: "Menos manual", desc: "Erros humanos reduzidos a quase zero." },
  { icon: Puzzle, title: "Integrado", desc: "Toda sua stack conversando em tempo real." },
  { icon: Headphones, title: "Suporte veloz", desc: "Time técnico direto no WhatsApp para você." },
];

export const PROCESS_STEPS = [
  { n: "1", title: "Crie seu atendente", desc: "Defina o que ele precisa responder para ajudar seus clientes." },
  { n: "2", title: "Escolha onde usar", desc: "Conecte no WhatsApp, site, sistema ou operação de loja." },
  {
    n: "3",
    title: "Ele começa a responder",
    desc: "Seu atendimento ganha velocidade sem depender de resposta manual.",
    highlight: true,
  },
];

export type NicheItem = {
  icon: LucideIcon;
  label: string;
};

export const NICHE_ITEMS: NicheItem[] = [
  { icon: Home, label: "Imobiliárias" },
  { icon: Stethoscope, label: "Clínicas" },
  { icon: ShoppingBag, label: "Lojas" },
  { icon: Hammer, label: "Prestadores" },
  { icon: Building2, label: "PMEs" },
];

export const FOOTER_SOLUTION_LINKS = ["Automações", "Sistemas", "IA", "API integrations"];
export const FOOTER_COMPANY_LINKS = ["Sobre nós", "Privacidade", "Contato", "Carreiras"];
