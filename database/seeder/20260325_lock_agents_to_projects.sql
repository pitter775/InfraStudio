begin;

-- Blindagem relacional para impedir que recursos de um projeto apontem
-- para agentes de outro projeto. Esta migration nao altera a documentacao
-- do schema; ela apenas saneia dados existentes e adiciona guardrails
-- definitivos no banco.

-- 1) Garantir chave composta reutilizavel para FKs por projeto/agente.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agentes_projeto_id_id_key'
      and conrelid = 'public.agentes'::regclass
  ) then
    alter table public.agentes
      add constraint agentes_projeto_id_id_key unique (projeto_id, id);
  end if;
end
$$;

-- 2) Saneamento de dados antigos com vinculo cruzado.
update public.chat_widgets as cw
set agente_id = null,
    updated_at = now()
from public.agentes as a
where cw.agente_id = a.id
  and cw.agente_id is not null
  and (cw.projeto_id is null or a.projeto_id is distinct from cw.projeto_id);

update public.canais_whatsapp as c
set agente_id = null,
    status = 'inativo',
    updated_at = now()
from public.agentes as a
where c.agente_id = a.id
  and c.agente_id is not null
  and a.projeto_id is distinct from c.projeto_id;

update public.chats as c
set agente_id = null,
    updated_at = now(),
    contexto = coalesce(c.contexto, '{}'::jsonb)
      || jsonb_build_object(
        'guardrail',
        jsonb_build_object(
          'cross_project_agent_cleared', true,
          'cleared_at', now()
        )
      )
from public.agentes as a
where c.agente_id = a.id
  and c.agente_id is not null
  and (c.projeto_id is null or a.projeto_id is distinct from c.projeto_id);

update public.conectores as c
set agente_id = null,
    updated_at = now()
from public.agentes as a
where c.agente_id = a.id
  and c.agente_id is not null
  and a.projeto_id is distinct from c.projeto_id;

update public.agente_arquivos as aa
set projeto_id = a.projeto_id,
    updated_at = now()
from public.agentes as a
where aa.agente_id = a.id
  and (
    aa.projeto_id is null
    or aa.projeto_id is distinct from a.projeto_id
  );

-- 3) Checks simples para nao existir agente sem projeto nas tabelas que
-- dependem de escopo de projeto.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_widgets_agent_requires_project_chk'
      and conrelid = 'public.chat_widgets'::regclass
  ) then
    alter table public.chat_widgets
      add constraint chat_widgets_agent_requires_project_chk
      check (agente_id is null or projeto_id is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chats_agent_requires_project_chk'
      and conrelid = 'public.chats'::regclass
  ) then
    alter table public.chats
      add constraint chats_agent_requires_project_chk
      check (agente_id is null or projeto_id is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agente_arquivos_agent_requires_project_chk'
      and conrelid = 'public.agente_arquivos'::regclass
  ) then
    alter table public.agente_arquivos
      add constraint agente_arquivos_agent_requires_project_chk
      check (projeto_id is not null);
  end if;
end
$$;

-- 4) Foreign keys compostas: se houver agente, ele precisa pertencer ao
-- mesmo projeto do registro.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_widgets_projeto_agente_fkey'
      and conrelid = 'public.chat_widgets'::regclass
  ) then
    alter table public.chat_widgets
      add constraint chat_widgets_projeto_agente_fkey
      foreign key (projeto_id, agente_id)
      references public.agentes (projeto_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'canais_whatsapp_projeto_agente_fkey'
      and conrelid = 'public.canais_whatsapp'::regclass
  ) then
    alter table public.canais_whatsapp
      add constraint canais_whatsapp_projeto_agente_fkey
      foreign key (projeto_id, agente_id)
      references public.agentes (projeto_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chats_projeto_agente_fkey'
      and conrelid = 'public.chats'::regclass
  ) then
    alter table public.chats
      add constraint chats_projeto_agente_fkey
      foreign key (projeto_id, agente_id)
      references public.agentes (projeto_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'conectores_projeto_agente_fkey_v2'
      and conrelid = 'public.conectores'::regclass
  ) then
    alter table public.conectores
      add constraint conectores_projeto_agente_fkey_v2
      foreign key (projeto_id, agente_id)
      references public.agentes (projeto_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agente_arquivos_projeto_agente_fkey'
      and conrelid = 'public.agente_arquivos'::regclass
  ) then
    alter table public.agente_arquivos
      add constraint agente_arquivos_projeto_agente_fkey
      foreign key (projeto_id, agente_id)
      references public.agentes (projeto_id, id);
  end if;
end
$$;

commit;
