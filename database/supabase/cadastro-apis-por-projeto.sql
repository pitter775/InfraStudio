begin;

create extension if not exists "uuid-ossp";

create table if not exists public.apis (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  nome character varying not null,
  url text not null,
  metodo character varying not null default 'GET',
  descricao text,
  ativo boolean not null default true,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint apis_metodo_check check (upper(metodo) = 'GET')
);

create table if not exists public.api_campos (
  id uuid primary key default uuid_generate_v4(),
  api_id uuid not null references public.apis(id) on delete cascade,
  nome character varying not null,
  tipo character varying not null,
  descricao text,
  created_at timestamp without time zone not null default now(),
  constraint api_campos_tipo_check check (tipo in ('string', 'number', 'boolean'))
);

create table if not exists public.agente_api (
  id uuid primary key default uuid_generate_v4(),
  agente_id uuid not null references public.agentes(id) on delete cascade,
  api_id uuid not null references public.apis(id) on delete cascade,
  created_at timestamp without time zone not null default now()
);

create index if not exists apis_projeto_id_idx
  on public.apis (projeto_id);

create index if not exists apis_ativo_idx
  on public.apis (projeto_id, ativo);

create index if not exists api_campos_api_id_idx
  on public.api_campos (api_id);

create index if not exists agente_api_agente_id_idx
  on public.agente_api (agente_id);

create index if not exists agente_api_api_id_idx
  on public.agente_api (api_id);

create unique index if not exists apis_nome_por_projeto_unique_idx
  on public.apis (projeto_id, lower(nome));

create unique index if not exists api_campos_nome_por_api_unique_idx
  on public.api_campos (api_id, lower(nome));

create unique index if not exists agente_api_unique_idx
  on public.agente_api (agente_id, api_id);

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.apis to service_role;
grant select, insert, update, delete on table public.api_campos to service_role;
grant select, insert, update, delete on table public.agente_api to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
