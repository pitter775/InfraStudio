begin;

create extension if not exists "uuid-ossp";

alter table public.projetos
  add column if not exists slug character varying;

alter table public.agentes
  add column if not exists slug character varying,
  add column if not exists updated_at timestamp without time zone default now();

alter table public.chats
  add column if not exists agente_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'chats'
      and constraint_name = 'chats_agente_id_fkey'
  ) then
    alter table public.chats
      add constraint chats_agente_id_fkey
      foreign key (agente_id) references public.agentes(id);
  end if;
end $$;

create table if not exists public.conectores (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id),
  agente_id uuid references public.agentes(id),
  slug character varying,
  nome character varying not null,
  tipo character varying not null,
  descricao text,
  endpoint_base text,
  metodo_auth character varying,
  configuracoes jsonb,
  ativo boolean default true,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

create unique index if not exists projetos_slug_unique_idx
  on public.projetos (lower(slug))
  where slug is not null;

create unique index if not exists agentes_slug_por_projeto_unique_idx
  on public.agentes (projeto_id, lower(slug))
  where slug is not null;

create unique index if not exists conectores_slug_por_projeto_unique_idx
  on public.conectores (projeto_id, lower(slug))
  where slug is not null;

create unique index if not exists agentes_ativo_por_projeto_unique_idx
  on public.agentes (projeto_id)
  where ativo = true and projeto_id is not null;

create index if not exists chats_agente_id_idx
  on public.chats (agente_id);

create index if not exists conectores_projeto_id_idx
  on public.conectores (projeto_id);

create index if not exists conectores_agente_id_idx
  on public.conectores (agente_id);

insert into public.projetos (
  slug,
  nome,
  tipo,
  descricao,
  status,
  configuracoes,
  created_at,
  updated_at
)
select
  'infrastudio',
  'InfraStudio',
  'interno',
  'Projeto interno principal da InfraStudio para site, admin e agente comercial.',
  'ativo',
  jsonb_build_object(
    'origem', 'core',
    'chat_publico', true
  ),
  now(),
  now()
where not exists (
  select 1 from public.projetos where lower(slug) = 'infrastudio'
);

with projeto_infrastudio as (
  select id
  from public.projetos
  where lower(slug) = 'infrastudio'
  limit 1
)
update public.agentes
set
  projeto_id = projeto_infrastudio.id,
  slug = coalesce(
    agentes.slug,
    lower(regexp_replace(coalesce(agentes.nome, 'agente'), '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  updated_at = now()
from projeto_infrastudio
where agentes.projeto_id is null;

with projeto_infrastudio as (
  select id
  from public.projetos
  where lower(slug) = 'infrastudio'
  limit 1
),
agente_ativo as (
  select id
  from public.agentes
  where projeto_id = (select id from projeto_infrastudio)
    and ativo = true
  order by created_at asc
  limit 1
)
update public.chats
set
  projeto_id = coalesce(public.chats.projeto_id, projeto_infrastudio.id),
  agente_id = coalesce(public.chats.agente_id, agente_ativo.id),
  updated_at = now()
from projeto_infrastudio, agente_ativo
where public.chats.projeto_id is null
   or public.chats.agente_id is null;

with projeto_infrastudio as (
  select id
  from public.projetos
  where lower(slug) = 'infrastudio'
  limit 1
)
update public.consumos
set projeto_id = projeto_infrastudio.id
from projeto_infrastudio
where public.consumos.projeto_id is null;

with projeto_infrastudio as (
  select id
  from public.projetos
  where lower(slug) = 'infrastudio'
  limit 1
)
update public.logs
set projeto_id = projeto_infrastudio.id
from projeto_infrastudio
where public.logs.projeto_id is null;

with projeto_infrastudio as (
  select id
  from public.projetos
  where lower(slug) = 'infrastudio'
  limit 1
)
update public.segredos
set projeto_id = projeto_infrastudio.id
from projeto_infrastudio
where public.segredos.projeto_id is null;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.projetos to service_role;
grant select, insert, update, delete on table public.agentes to service_role;
grant select, insert, update, delete on table public.chats to service_role;
grant select, insert, update, delete on table public.conectores to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
