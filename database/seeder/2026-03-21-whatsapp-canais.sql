create extension if not exists "uuid-ossp";

create table if not exists public.canais_whatsapp (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  agente_id uuid references public.agentes(id) on delete set null,
  numero character varying not null,
  session_data jsonb,
  status character varying not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

alter table public.chats
  add column if not exists canal character varying not null default 'web',
  add column if not exists identificador_externo text;

alter table public.mensagens
  add column if not exists canal character varying not null default 'web',
  add column if not exists identificador_externo text;

create index if not exists canais_whatsapp_projeto_id_idx on public.canais_whatsapp (projeto_id);
create index if not exists canais_whatsapp_agente_id_idx on public.canais_whatsapp (agente_id);
create index if not exists canais_whatsapp_numero_idx on public.canais_whatsapp (numero);
create index if not exists chats_canal_identificador_externo_idx on public.chats (canal, identificador_externo);
create index if not exists chats_projeto_canal_identificador_idx on public.chats (projeto_id, canal, identificador_externo);
create index if not exists mensagens_canal_identificador_externo_idx on public.mensagens (canal, identificador_externo);
