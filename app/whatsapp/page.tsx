import type { Metadata } from "next";
import { WhatsappLandingPage } from "@/app/_components/whatsapp/landing";

export const metadata: Metadata = {
  title: "Automacao de WhatsApp com IA",
  description: "Seu WhatsApp respondendo clientes sozinho com uma experiencia simples, premium e pronta para testar.",
  alternates: {
    canonical: "/whatsapp",
  },
};

export default function WhatsappPage() {
  return <WhatsappLandingPage />;
}
