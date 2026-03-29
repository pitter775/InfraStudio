-- Vincula o usuario comum "Reliquia de Familia" ao projeto correto.
-- Nao sincroniza o snapshot geral-schema.sql.

insert into public.usuarios_projetos (
  usuario_id,
  projeto_id,
  papel,
  created_at
)
select
  u.id,
  p.id,
  'viewer',
  now()
from public.usuarios u
join public.projetos p
  on p.slug = 'reliquia_de_familia'
where u.email = 'reliquia@infra.com'
  and not exists (
    select 1
    from public.usuarios_projetos up
    where up.usuario_id = u.id
      and up.projeto_id = p.id
  );

update public.usuarios_projetos up
set
  papel = 'viewer'
from public.usuarios u
join public.projetos p
  on p.slug = 'reliquia_de_familia'
where up.usuario_id = u.id
  and up.projeto_id = p.id
  and u.email = 'reliquia@infra.com';
