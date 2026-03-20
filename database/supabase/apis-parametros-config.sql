alter table public.apis
  add column if not exists configuracoes jsonb not null default '{}'::jsonb;

update public.apis
set configuracoes = coalesce(configuracoes, '{}'::jsonb)
where configuracoes is null;
