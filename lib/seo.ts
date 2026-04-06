import type { Metadata } from "next";

const siteName = "InfraStudio";
const siteUrl = "https://infrastudio.pro";
const defaultTitle = "InfraStudio";
const defaultDescription =
  "Automacao com IA, WhatsApp inteligente e sistemas sob medida para vender mais sem aumentar a operacao manual.";
const defaultOgImage = "/compartilhar_novo.png";

type PublicRouteConfig = {
  path: string;
  title: string;
  description: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

export const seoConfig = {
  siteName,
  siteUrl,
  defaultTitle,
  titleTemplate: `%s | ${siteName}`,
  defaultDescription,
  defaultOgImage,
};

export const publicRoutes: PublicRouteConfig[] = [
  {
    path: "/",
    title: "Automacao com IA para WhatsApp, site e operacao",
    description:
      "Crie atendentes com IA para WhatsApp, site e fluxos internos com uma base tecnica pronta para integrar canais, APIs e atendimento humano.",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/whatsapp",
    title: "Automacao de WhatsApp com IA",
    description:
      "Automatize o atendimento no WhatsApp com IA, respostas consistentes e handoff humano quando a operacao precisar assumir a conversa.",
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: "/docs/chat-widget-host-control",
    title: "Documentacao do Chat Widget Host-Controlled",
    description:
      "Guia tecnico para integrar o chat widget da InfraStudio com controle de host, isolamento de contexto e regras claras de ciclo de vida.",
    changeFrequency: "monthly",
    priority: 0.7,
  },
];

export function absoluteUrl(path: string) {
  return path === "/" ? siteUrl : `${siteUrl}${path}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image = defaultOgImage,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = path === "/" ? siteName : `${title} | ${siteName}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName,
      title: fullTitle,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
