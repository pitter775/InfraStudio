-- Diagnostico rapido do chat "nexo" + agente "agente-imovel"
-- Rode no SQL Editor do Supabase.

-- 1) Widget / projeto / agente resolvidos pelo embed
select
  cw.id as widget_id,
  cw.nome as widget_nome,
  cw.slug as widget_slug,
  p.slug as projeto_slug,
  a.slug as agente_slug,
  a.nome as agente_nome,
  cw.whatsapp_celular
from public.chat_widgets cw
left join public.projetos p on p.id = cw.projeto_id
left join public.agentes a on a.id = cw.agente_id
where p.slug = 'nexo'
  and (a.slug = 'agente-imovel' or cw.agente_id is null)
order by cw.created_at asc;

-- 2) APIs realmente vinculadas ao agente
select
  a.slug as agente_slug,
  api.id as api_id,
  api.nome as api_nome,
  api.url,
  api.ativo,
  api.configuracoes
from public.agentes a
join public.agente_api aa on aa.agente_id = a.id
join public.apis api on api.id = aa.api_id
join public.projetos p on p.id = a.projeto_id
where p.slug = 'nexo'
  and a.slug = 'agente-imovel'
order by api.created_at asc;

-- 3) Campos salvos da API ligada ao agente
select
  api.nome as api_nome,
  ac.nome as campo_nome,
  ac.tipo
from public.agentes a
join public.agente_api aa on aa.agente_id = a.id
join public.apis api on api.id = aa.api_id
join public.api_campos ac on ac.api_id = api.id
join public.projetos p on p.id = a.projeto_id
where p.slug = 'nexo'
  and a.slug = 'agente-imovel'
order by api.nome, ac.nome;

-- 4) Procura especifica por matricula/cartorio/juridico
select
  api.nome as api_nome,
  ac.nome as campo_nome,
  ac.tipo
from public.agentes a
join public.agente_api aa on aa.agente_id = a.id
join public.apis api on api.id = aa.api_id
join public.api_campos ac on ac.api_id = api.id
join public.projetos p on p.id = a.projeto_id
where p.slug = 'nexo'
  and a.slug = 'agente-imovel'
  and (
    lower(ac.nome) like '%matricula%'
    or lower(ac.nome) like '%cartorio%'
    or lower(ac.nome) like '%jurid%'
  )
order by api.nome, ac.nome;

-- 5) Parametros configurados na API para confirmar se o id esta obrigatorio
select
  api.nome as api_nome,
  api.url,
  api.configuracoes -> 'parametros' as parametros
from public.agentes a
join public.agente_api aa on aa.agente_id = a.id
join public.apis api on api.id = aa.api_id
join public.projetos p on p.id = a.projeto_id
where p.slug = 'nexo'
  and a.slug = 'agente-imovel'
order by api.created_at asc;
