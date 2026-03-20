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
  { n: "1", title: "Explique a dor", desc: "Conte o que trava o crescimento da sua empresa hoje." },
  { n: "2", title: "Diagnóstico", desc: "Analisamos a melhor stack tecnológica para resolver." },
  { n: "3", title: "Arquitetura", desc: "Desenvolvemos o projeto lógico e visual do seu sistema." },
  { n: "4", title: "Mão na massa", desc: "Nossa equipe codifica sua solução." },
  { n: "5", title: "Eficiência", desc: "Entrega, treinamento e colheita de resultados.", highlight: true },
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
