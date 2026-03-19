import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ApiCampoInput = {
  nome: string;
  tipo: "string" | "number" | "boolean";
  descricao?: string | null;
};

export type ApiCampoRecord = {
  id: string;
  apiId: string;
  nome: string;
  tipo: "string" | "number" | "boolean";
  descricao: string;
  createdAt: string;
};

export type ApiRecord = {
  id: string;
  projetoId: string | null;
  nome: string;
  url: string;
  metodo: "GET";
  descricao: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  campos: ApiCampoRecord[];
};

type ApiCampoRow = {
  id: string;
  api_id: string | null;
  nome: string | null;
  tipo: "string" | "number" | "boolean" | null;
  descricao: string | null;
  created_at: string | null;
};

type ApiRow = {
  id: string;
  projeto_id: string | null;
  nome: string | null;
  url: string | null;
  metodo: string | null;
  descricao: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  api_campos?: ApiCampoRow[] | null;
};

function mapApiCampo(row: ApiCampoRow): ApiCampoRecord {
  return {
    id: row.id,
    apiId: row.api_id ?? "",
    nome: row.nome?.trim() || "campo",
    tipo: row.tipo ?? "string",
    descricao: row.descricao?.trim() || "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function mapApi(row: ApiRow): ApiRecord {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    nome: row.nome?.trim() || "API sem nome",
    url: row.url?.trim() || "",
    metodo: "GET",
    descricao: row.descricao?.trim() || "",
    ativo: Boolean(row.ativo),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    campos: (row.api_campos ?? []).map((campo) => mapApiCampo(campo)),
  };
}

function sanitizeMetodo(value: string | null | undefined): "GET" {
  if (!value) {
    return "GET";
  }

  return value.trim().toUpperCase() === "GET" ? "GET" : "GET";
}

function sanitizeCampos(campos: ApiCampoInput[]) {
  const seen = new Set<string>();

  return campos
    .map((campo) => ({
      nome: campo.nome.trim(),
      tipo: campo.tipo,
      descricao: campo.descricao?.trim() || null,
    }))
    .filter((campo) => {
      if (!campo.nome || seen.has(campo.nome.toLowerCase())) {
        return false;
      }

      seen.add(campo.nome.toLowerCase());
      return true;
    });
}

function inferFieldType(value: unknown): ApiCampoInput["tipo"] | null {
  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (value === null) {
    return "string";
  }

  return null;
}

function extractApiCampos(payload: unknown): ApiCampoInput[] {
  const source =
    Array.isArray(payload) ? (payload.find((item) => item && typeof item === "object" && !Array.isArray(item)) ?? null) : payload;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return [];
  }

  return Object.entries(source).flatMap(([nome, value]) => {
    const tipo = inferFieldType(value);
    if (!tipo) {
      return [];
    }

    return [{ nome, tipo, descricao: null }];
  });
}

async function replaceApiCampos(apiId: string, campos: ApiCampoInput[]) {
  const supabase = getSupabaseAdminClient();
  const sanitized = sanitizeCampos(campos);

  const { error: deleteError } = await supabase.from("api_campos").delete().eq("api_id", apiId);
  if (deleteError) {
    console.error("[apis] failed to clear api fields", deleteError);
    return false;
  }

  if (!sanitized.length) {
    return true;
  }

  const { error: insertError } = await supabase.from("api_campos").insert(
    sanitized.map((campo) => ({
      api_id: apiId,
      nome: campo.nome,
      tipo: campo.tipo,
      descricao: campo.descricao,
      created_at: new Date().toISOString(),
    })) as never,
  );

  if (insertError) {
    console.error("[apis] failed to persist api fields", insertError);
    return false;
  }

  return true;
}

export async function listApis(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("apis")
    .select("id, projeto_id, nome, url, metodo, descricao, ativo, created_at, updated_at, api_campos(id, api_id, nome, tipo, descricao, created_at)")
    .eq("projeto_id", projetoId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[apis] failed to list apis", error);
    return [];
  }

  return data.map((row) => mapApi(row as ApiRow));
}

export async function getApiById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("apis")
    .select("id, projeto_id, nome, url, metodo, descricao, ativo, created_at, updated_at, api_campos(id, api_id, nome, tipo, descricao, created_at)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[apis] failed to load api", error);
    }
    return null;
  }

  return mapApi(data as ApiRow);
}

export async function createApi(input: {
  projetoId: string;
  nome: string;
  url: string;
  metodo?: string | null;
  descricao?: string | null;
  ativo?: boolean;
  campos?: ApiCampoInput[];
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("apis")
    .insert({
      projeto_id: input.projetoId,
      nome: input.nome.trim(),
      url: input.url.trim(),
      metodo: sanitizeMetodo(input.metodo),
      descricao: input.descricao?.trim() || null,
      ativo: input.ativo ?? true,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, projeto_id, nome, url, metodo, descricao, ativo, created_at, updated_at, api_campos(id, api_id, nome, tipo, descricao, created_at)")
    .single();

  if (error || !data) {
    console.error("[apis] failed to create api", error);
    return null;
  }

  const api = mapApi(data as ApiRow);
  const camposSalvos = await replaceApiCampos(api.id, input.campos ?? []);
  if (!camposSalvos) {
    return api;
  }

  return await getApiById(api.id);
}

export async function updateApi(input: {
  id: string;
  nome: string;
  url: string;
  metodo?: string | null;
  descricao?: string | null;
  ativo?: boolean;
  campos?: ApiCampoInput[];
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("apis")
    .update({
      nome: input.nome.trim(),
      url: input.url.trim(),
      metodo: sanitizeMetodo(input.metodo),
      descricao: input.descricao?.trim() || null,
      ativo: input.ativo ?? true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, projeto_id, nome, url, metodo, descricao, ativo, created_at, updated_at, api_campos(id, api_id, nome, tipo, descricao, created_at)")
    .single();

  if (error || !data) {
    console.error("[apis] failed to update api", error);
    return null;
  }

  if (input.campos) {
    const camposSalvos = await replaceApiCampos(input.id, input.campos);
    if (!camposSalvos) {
      return mapApi(data as ApiRow);
    }
  }

  return await getApiById(input.id);
}

export async function deleteApi(id: string) {
  const supabase = getSupabaseAdminClient();

  const { error: pivotError } = await supabase.from("agente_api").delete().eq("api_id", id);
  if (pivotError) {
    console.error("[apis] failed to remove agent links", pivotError);
    return false;
  }

  const { error: fieldError } = await supabase.from("api_campos").delete().eq("api_id", id);
  if (fieldError) {
    console.error("[apis] failed to remove api fields", fieldError);
    return false;
  }

  const { error } = await supabase.from("apis").delete().eq("id", id);
  if (error) {
    console.error("[apis] failed to delete api", error);
    return false;
  }

  return true;
}

export async function testApi(id: string) {
  const api = await getApiById(id);
  if (!api) {
    return { api: null, campos: [], error: "API nao encontrada." };
  }

  const response = await fetch(api.url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return { api, campos: [], error: `A requisicao retornou status ${response.status}.` };
  }

  const payload = (await response.json()) as unknown;
  const campos = extractApiCampos(payload);

  if (!campos.length) {
    return { api, campos: [], error: "Nenhum campo primitivo de primeiro nivel foi encontrado na resposta." };
  }

  const saved = await replaceApiCampos(id, campos);
  if (!saved) {
    return { api, campos: [], error: "Nao foi possivel salvar os campos detectados." };
  }

  return {
    api: await getApiById(id),
    campos,
    error: null,
  };
}

export async function listApiIdsByAgentes(agenteIds: string[]) {
  if (!agenteIds.length) {
    return new Map<string, string[]>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("agente_api").select("agente_id, api_id").in("agente_id", agenteIds);

  if (error || !data) {
    console.error("[apis] failed to list agent api links", error);
    return new Map<string, string[]>();
  }

  const map = new Map<string, string[]>();
  for (const row of data as { agente_id: string | null; api_id: string | null }[]) {
    if (!row.agente_id || !row.api_id) {
      continue;
    }

    const current = map.get(row.agente_id) ?? [];
    current.push(row.api_id);
    map.set(row.agente_id, current);
  }

  return map;
}

export async function syncAgenteApis(agenteId: string, projetoId: string, apiIds: string[]) {
  const supabase = getSupabaseAdminClient();
  const sanitizedIds = [...new Set(apiIds.filter(Boolean))];

  const { data: allowedApis, error: allowedError } = await supabase
    .from("apis")
    .select("id")
    .eq("projeto_id", projetoId)
    .in("id", sanitizedIds.length ? sanitizedIds : ["00000000-0000-0000-0000-000000000000"]);

  if (allowedError) {
    console.error("[apis] failed to validate agent api links", allowedError);
    return false;
  }

  const allowedIds = new Set(((allowedApis ?? []) as Array<{ id: string }>).map((item) => item.id));

  const { error: deleteError } = await supabase.from("agente_api").delete().eq("agente_id", agenteId);
  if (deleteError) {
    console.error("[apis] failed to clear agent api links", deleteError);
    return false;
  }

  const rows = sanitizedIds
    .filter((apiId) => allowedIds.has(apiId))
    .map((apiId) => ({
      agente_id: agenteId,
      api_id: apiId,
    }));

  if (!rows.length) {
    return true;
  }

  const { error: insertError } = await supabase.from("agente_api").insert(rows as never);
  if (insertError) {
    console.error("[apis] failed to persist agent api links", insertError);
    return false;
  }

  return true;
}
