-- Diferenca minima e necessaria em relacao ao database/geral-schema.sql
-- Objetivo: habilitar anexos/arquivos de agente com upload no Supabase Storage.
-- Este arquivo NAO faz seed, NAO faz backfill e NAO altera dados existentes.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.agente_arquivos (
  id uuid primary key default uuid_generate_v4(),
  agente_id uuid not null references public.agentes(id) on delete cascade,
  projeto_id uuid references public.projetos(id) on delete cascade,
  nome character varying not null,
  descricao text,
  arquivo_nome character varying not null,
  mime_type character varying not null,
  tamanho_bytes integer not null default 0,
  categoria character varying not null check (categoria in ('image', 'file')),
  storage_path text not null unique,
  public_url text not null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

create index if not exists agente_arquivos_agente_id_idx
  on public.agente_arquivos (agente_id);

create index if not exists agente_arquivos_projeto_id_idx
  on public.agente_arquivos (projeto_id);

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.agente_arquivos to service_role;

insert into storage.buckets (id, name, public)
values ('agente-assets', 'agente-assets', true)
on conflict (id) do update
set public = excluded.public;

commit;
