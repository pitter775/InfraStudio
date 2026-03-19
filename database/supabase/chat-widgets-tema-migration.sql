begin;

alter table public.chat_widgets
  add column if not exists tema character varying not null default 'dark';

alter table public.chat_widgets
  add column if not exists cor_primaria character varying not null default '#2563eb';

alter table public.chat_widgets
  add column if not exists fundo_transparente boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_widgets_tema_check'
  ) then
    alter table public.chat_widgets
      add constraint chat_widgets_tema_check
      check (tema in ('dark', 'light'));
  end if;
end $$;

update public.chat_widgets
set
  tema = coalesce(nullif(tema, ''), 'dark'),
  cor_primaria = coalesce(nullif(cor_primaria, ''), '#2563eb'),
  fundo_transparente = coalesce(fundo_transparente, true);

commit;
