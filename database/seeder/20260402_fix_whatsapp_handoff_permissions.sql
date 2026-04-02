grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.whatsapp_handoff_contatos
  to service_role;

grant select, insert, update, delete
  on table public.chat_handoffs
  to service_role;

grant select, insert, update, delete
  on table public.chat_handoff_eventos
  to service_role;
