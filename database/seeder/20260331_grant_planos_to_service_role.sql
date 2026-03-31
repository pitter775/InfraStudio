-- Permite que o backend admin consulte e gerencie a tabela de planos via service role.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.planos to service_role;
