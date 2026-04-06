import { HomePageClient } from "@/app/_components/home/home-page-client";
import { buildPageMetadata } from "@/lib/seo";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = buildPageMetadata({
  title: "Automacao com IA para WhatsApp, site e operacao",
  description:
    "Crie atendentes com IA para WhatsApp, site e fluxos internos com uma base tecnica pronta para integrar canais, APIs e atendimento humano.",
  path: "/",
});

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  return (
    <HomePageClient
      projeto={readSearchParam(params.projeto)}
      agente={readSearchParam(params.agente)}
      returnTo={readSearchParam(params.returnTo)}
      handoffError={readSearchParam(params.handoff_error)}
      embed={readSearchParam(params.embed)}
    />
  );
}
