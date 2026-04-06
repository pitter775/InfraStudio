import type { Metadata } from "next";
import { WhatsappLandingPage } from "@/app/_components/whatsapp/landing";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Automacao de WhatsApp com IA",
  description:
    "Automatize o atendimento no WhatsApp com IA, respostas consistentes e handoff humano quando a operacao precisar assumir a conversa.",
  path: "/whatsapp",
  image: "/whatsapp/opengraph-image",
});

export default function WhatsappPage() {
  return <WhatsappLandingPage />;
}
