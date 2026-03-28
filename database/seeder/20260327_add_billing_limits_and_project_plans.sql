begin;

-- Base inicial para plano por projeto, limite por usuario e bloqueio manual/automatico.
-- Nao altera o snapshot em geral-schema.sql. Aplicar manualmente no Supabase.

create table if not exists public.projetos_planos (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null unique references public.projetos(id) on delete cascade,
  nome_plano character varying not null default 'padrao',
  modelo_referencia character varying not null default 'gpt-4o-mini',
  limite_tokens_input_mensal integer,
  limite_tokens_output_mensal integer,
  limite_tokens_total_mensal integer,
  limite_custo_mensal numeric,
  auto_bloquear boolean not null default true,
  bloqueado boolean not null default false,
  bloqueado_motivo text,
  observacoes text,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint projetos_planos_limites_chk check (
    coalesce(limite_tokens_input_mensal, 0) >= 0
    and coalesce(limite_tokens_output_mensal, 0) >= 0
    and coalesce(limite_tokens_total_mensal, 0) >= 0
    and coalesce(limite_custo_mensal, 0) >= 0
  )
);

create table if not exists public.usuarios_limites_ia (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  papel_financeiro character varying not null default 'padrao',
  modelo_referencia character varying not null default 'gpt-4o-mini',
  limite_tokens_input_mensal integer,
  limite_tokens_output_mensal integer,
  limite_tokens_total_mensal integer,
  limite_custo_mensal numeric,
  auto_bloquear boolean not null default true,
  bloqueado boolean not null default false,
  bloqueado_motivo text,
  observacoes text,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint usuarios_limites_ia_unique unique (usuario_id, projeto_id),
  constraint usuarios_limites_ia_limites_chk check (
    coalesce(limite_tokens_input_mensal, 0) >= 0
    and coalesce(limite_tokens_output_mensal, 0) >= 0
    and coalesce(limite_tokens_total_mensal, 0) >= 0
    and coalesce(limite_custo_mensal, 0) >= 0
  )
);

create index if not exists consumos_projeto_created_at_idx
  on public.consumos (projeto_id, created_at desc);

create index if not exists consumos_usuario_created_at_idx
  on public.consumos (usuario_id, created_at desc);

create index if not exists consumos_projeto_usuario_created_at_idx
  on public.consumos (projeto_id, usuario_id, created_at desc);

insert into public.projetos_planos (
  projeto_id,
  nome_plano,
  modelo_referencia,
  auto_bloquear,
  bloqueado,
  created_at,
  updated_at
)
select
  p.id,
  'padrao',
  'gpt-4o-mini',
  true,
  false,
  now(),
  now()
from public.projetos as p
where not exists (
  select 1
  from public.projetos_planos as pp
  where pp.projeto_id = p.id
);

commit;
