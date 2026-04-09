-- InfraStudio demo mode support
-- Snapshot schema file must remain untouched; keep evolutions here.

alter table if exists projetos
  add column if not exists is_demo boolean default false;

alter table if exists canais_whatsapp
  add column if not exists session_id text,
  add column if not exists modo text default 'real',
  add column if not exists expira_em timestamptz;

create index if not exists idx_projetos_is_demo on projetos (is_demo);
create index if not exists idx_canais_whatsapp_expira_em on canais_whatsapp (expira_em);
