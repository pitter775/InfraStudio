import { NovaHomeClient } from "@/app/nova_home/nova-home-client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Teste o InfraStudio sem cadastro",
  description: "Crie um atendente com IA em segundos e teste funcionando agora, sem cadastro.",
  path: "/nova_home",
});

export default function NovaHomePage() {
  return <NovaHomeClient />;
}
