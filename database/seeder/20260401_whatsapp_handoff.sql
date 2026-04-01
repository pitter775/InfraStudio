create table if not exists public.whatsapp_handoff_contatos (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  canal_whatsapp_id uuid references public.canais_whatsapp(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  nome character varying not null,
  numero character varying not null,
  papel character varying,
  observacoes text,
  ativo boolean not null default true,
  receber_alertas boolean not null default true,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint whatsapp_handoff_contatos_numero_unique unique (projeto_id, numero)
);

create index if not exists whatsapp_handoff_contatos_projeto_idx
  on public.whatsapp_handoff_contatos (projeto_id, ativo, receber_alertas);

create index if not exists whatsapp_handoff_contatos_canal_idx
  on public.whatsapp_handoff_contatos (canal_whatsapp_id);

create table if not exists public.chat_handoffs (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  canal_whatsapp_id uuid references public.canais_whatsapp(id) on delete set null,
  status character varying not null default 'bot'
    check (status in ('bot', 'pending_human', 'human')),
  motivo text,
  requested_by character varying not null default 'system'
    check (requested_by in ('system', 'agent', 'human')),
  requested_by_usuario_id uuid references public.usuarios(id) on delete set null,
  claimed_by_usuario_id uuid references public.usuarios(id) on delete set null,
  released_by_usuario_id uuid references public.usuarios(id) on delete set null,
  requested_at timestamp without time zone not null default now(),
  claimed_at timestamp without time zone,
  released_at timestamp without time zone,
  last_alert_at timestamp without time zone,
  alert_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint chat_handoffs_chat_unique unique (chat_id)
);

create index if not exists chat_handoffs_projeto_status_idx
  on public.chat_handoffs (projeto_id, status, updated_at desc);

create index if not exists chat_handoffs_canal_idx
  on public.chat_handoffs (canal_whatsapp_id, status);

create table if not exists public.chat_handoff_eventos (
  id uuid primary key default uuid_generate_v4(),
  handoff_id uuid not null references public.chat_handoffs(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  tipo character varying not null
    check (tipo in ('requested', 'alert_sent', 'claimed', 'released', 'paused', 'resumed', 'note')),
  descricao text,
  usuario_id uuid references public.usuarios(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default now()
);

create index if not exists chat_handoff_eventos_chat_idx
  on public.chat_handoff_eventos (chat_id, created_at desc);

create index if not exists chat_handoff_eventos_handoff_idx
  on public.chat_handoff_eventos (handoff_id, created_at desc);
