-- Use este script no SQL Editor do Supabase.
-- Objetivo:
-- criar ou atualizar um usuario administrativo na tabela public.usuarios
-- usando senha com hash bcrypt via pgcrypto.

begin;

create extension if not exists pgcrypto;

create temp table if not exists _novo_usuario_admin (
  email text,
  nome text,
  senha_plana text,
  provider text,
  provider_id text,
  ativo boolean
) on commit drop;

truncate _novo_usuario_admin;

insert into _novo_usuario_admin (email, nome, senha_plana, provider, provider_id, ativo)
values (
  'adm@adm',
  'Administrador',
  '123456',
  'email',
  null,
  true
);

do $$
declare
  v_email text;
  v_nome text;
  v_senha_plana text;
  v_provider text;
  v_provider_id text;
  v_ativo boolean;
  v_usuario_id uuid;
begin
  select email, nome, senha_plana, provider, provider_id, ativo
    into v_email, v_nome, v_senha_plana, v_provider, v_provider_id, v_ativo
  from _novo_usuario_admin
  limit 1;

  select id
    into v_usuario_id
  from public.usuarios
  where email = v_email
  limit 1;

  if v_usuario_id is null then
    insert into public.usuarios (
      nome,
      email,
      senha,
      provider,
      provider_id,
      ativo,
      created_at,
      updated_at
    )
    values (
      coalesce(v_nome, split_part(v_email, '@', 1)),
      v_email,
      crypt(v_senha_plana, gen_salt('bf', 10)),
      coalesce(v_provider, 'email'),
      v_provider_id,
      coalesce(v_ativo, true),
      now(),
      now()
    )
    returning id into v_usuario_id;
  else
    update public.usuarios
       set nome = coalesce(v_nome, nome),
           email = v_email,
           senha = crypt(v_senha_plana, gen_salt('bf', 10)),
           provider = coalesce(v_provider, provider, 'email'),
           provider_id = coalesce(v_provider_id, provider_id),
           ativo = coalesce(v_ativo, true),
           updated_at = now()
     where id = v_usuario_id;
  end if;
end $$;

commit;

-- Verificacao rapida
select
  id,
  nome,
  email,
  provider,
  provider_id,
  ativo,
  created_at,
  updated_at
from public.usuarios
where email = 'adm@adm';
