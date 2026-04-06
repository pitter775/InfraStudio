import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ModeloRecord = {
  id: string;
  nome: string;
  provider: string;
  custoInput: number | null;
  custoOutput: number | null;
  ativo: boolean;
};

type ModeloRow = {
  id: string;
  nome: string | null;
  provider: string | null;
  custo_input: number | null;
  custo_output: number | null;
  ativo: boolean | null;
};

type ProjetoModeloRow = {
  modelo_id: string | null;
};

function mapModelo(row: ModeloRow | null): ModeloRecord | null {
  if (!row) {
    return null;
  }

  const nome = row.nome?.trim() ?? "";
  if (!nome) {
    return null;
  }

  return {
    id: row.id,
    nome,
    provider: row.provider?.trim() || "openai",
    custoInput: row.custo_input === null ? null : Number(row.custo_input),
    custoOutput: row.custo_output === null ? null : Number(row.custo_output),
    ativo: row.ativo !== false,
  };
}

function isSupportedProjectModel(modelo: ModeloRecord) {
  const normalizedName = modelo.nome.trim().toLowerCase();
  return normalizedName.startsWith("gpt-") && !normalizedName.startsWith("gpt-3");
}

function sortProjectModels(left: ModeloRecord, right: ModeloRecord) {
  if (left.nome === "gpt-4o-mini" && right.nome !== "gpt-4o-mini") {
    return -1;
  }

  if (right.nome === "gpt-4o-mini" && left.nome !== "gpt-4o-mini") {
    return 1;
  }

  if (left.nome === "gpt-4o" && right.nome !== "gpt-4o") {
    return -1;
  }

  if (right.nome === "gpt-4o" && left.nome !== "gpt-4o") {
    return 1;
  }

  return left.nome.localeCompare(right.nome, "pt-BR");
}

export async function listModelosDisponiveisParaProjeto() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("modelos").select("id, nome, provider, custo_input, custo_output, ativo").eq("ativo", true);

  if (error || !data) {
    console.error("[modelos] failed to list models", error);
    return [];
  }

  return (data as ModeloRow[])
    .map(mapModelo)
    .filter((item): item is ModeloRecord => Boolean(item))
    .filter(isSupportedProjectModel)
    .sort(sortProjectModels);
}

export async function getProjetoModeloSelecionado(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("projetos").select("modelo_id").eq("id", projetoId).maybeSingle();

  if (error) {
    console.error("[modelos] failed to load selected project model", error);
    return {
      modeloId: null,
      modelo: null,
    };
  }

  const projetoRow = (data ?? null) as ProjetoModeloRow | null;
  const modeloId = typeof projetoRow?.modelo_id === "string" && projetoRow.modelo_id.trim() ? projetoRow.modelo_id.trim() : null;
  if (!modeloId) {
    return {
      modeloId: null,
      modelo: null,
    };
  }

  const modeloResponse = await supabase.from("modelos").select("id, nome, provider, custo_input, custo_output, ativo").eq("id", modeloId).maybeSingle();
  if (modeloResponse.error) {
    console.error("[modelos] failed to load selected model details", modeloResponse.error);
    return {
      modeloId,
      modelo: null,
    };
  }

  const modelo = mapModelo((modeloResponse.data ?? null) as ModeloRow | null);
  return {
    modeloId,
    modelo,
  };
}
