import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type SegredoRow = {
  nome: string | null;
  valor: string | null;
};

export async function getProjetoSegredos(projetoId: string | null | undefined) {
  const secrets: Record<string, string> = {};

  if (!projetoId) {
    return secrets;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("segredos").select("nome, valor").eq("projeto_id", projetoId);

  if (error || !data) {
    if (error) {
      console.error("[segredos] failed to load project secrets", error);
    }
    return secrets;
  }

  for (const row of data as SegredoRow[]) {
    const key = row.nome?.trim();
    const value = row.valor?.trim();
    if (key && value) {
      secrets[key] = value;
    }
  }

  return secrets;
}

export async function getProjetoOpenAIConfig(projetoId: string | null | undefined) {
  const secrets = await getProjetoSegredos(projetoId);

  return {
    apiKey:
      secrets.OPENAI_API_KEY ??
      secrets.openai_api_key ??
      process.env.OPENAI_API_KEY ??
      null,
    model:
      secrets.OPENAI_CHAT_MODEL ??
      secrets.openai_chat_model ??
      process.env.OPENAI_CHAT_MODEL ??
      "gpt-4o-mini",
  };
}
