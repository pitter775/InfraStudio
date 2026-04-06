import "server-only";

import { getProjetoModeloSelecionado } from "@/lib/modelos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type SegredoRow = {
  nome: string | null;
  valor: string | null;
};

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

async function getProjetoModelName(projetoId: string | null | undefined) {
  if (!projetoId) {
    return null;
  }

  const selection = await getProjetoModeloSelecionado(projetoId);
  return selection.modelo?.nome ?? null;
}

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
  const projectModel = await getProjetoModelName(projetoId);

  return {
    apiKey:
      secrets.OPENAI_API_KEY ??
      secrets.openai_api_key ??
      process.env.OPENAI_API_KEY ??
      null,
    model: projectModel ?? DEFAULT_OPENAI_MODEL,
  };
}
