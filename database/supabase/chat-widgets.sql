begin;

create extension if not exists "uuid-ossp";

create table if not exists public.chat_widgets (
  id uuid primary key default uuid_generate_v4(),
  nome character varying not null,
  slug character varying not null,
  projeto_id uuid references public.projetos(id) on delete cascade,
  agente_id uuid references public.agentes(id) on delete set null,
  dominio text,
  tema character varying not null default 'dark',
  cor_primaria character varying not null default '#2563eb',
  fundo_transparente boolean not null default true,
  ativo boolean not null default true,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint chat_widgets_tema_check check (tema in ('dark', 'light'))
);

create unique index if not exists chat_widgets_slug_unique_idx
  on public.chat_widgets (lower(slug));

create index if not exists chat_widgets_projeto_id_idx
  on public.chat_widgets (projeto_id);

create index if not exists chat_widgets_agente_id_idx
  on public.chat_widgets (agente_id);

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.chat_widgets to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
