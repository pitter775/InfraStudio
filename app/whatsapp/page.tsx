import type { Metadata } from "next";
import { WhatsappLandingPage } from "@/app/_components/whatsapp/landing";

export const metadata: Metadata = {
  title: "Automacao de WhatsApp com IA",
  description: "Seu WhatsApp respondendo clientes sozinho com uma experiencia simples, premium e pronta para testar.",
  alternates: {
    canonical: "/whatsapp",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://infrastudio.vercel.app/whatsapp",
    siteName: "InfraStudio",
    title: "Automacao de WhatsApp com IA | InfraStudio",
    description: "Atenda clientes no WhatsApp com IA, respostas automaticas e uma operacao mais leve para o seu time.",
    images: [
      {
        url: "/whatsapp/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Automacao de WhatsApp com IA da InfraStudio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Automacao de WhatsApp com IA | InfraStudio",
    description: "Atenda clientes no WhatsApp com IA, respostas automaticas e uma operacao mais leve para o seu time.",
    images: ["/whatsapp/opengraph-image"],
  },
};

export default function WhatsappPage() {
  return <WhatsappLandingPage />;
}
