-- Seed do widget da home da InfraStudio.
-- Nao altera schema. Apenas cria/atualiza o registro em chat_widgets.
--
-- Requisitos:
-- 1) Ja existir um projeto com slug = 'infrastudio'
-- 2) Opcionalmente, depois vincule um agente especifico da home no admin
--    ou ajuste o UPDATE abaixo para setar agente_id manualmente.

DO $$
DECLARE
  v_projeto_id uuid;
  v_widget_id uuid;
BEGIN
  SELECT id
  INTO v_projeto_id
  FROM public.projetos
  WHERE slug = 'infrastudio'
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'Projeto com slug "infrastudio" nao encontrado.';
  END IF;

  SELECT id
  INTO v_widget_id
  FROM public.chat_widgets
  WHERE slug = 'infrastudio-home'
  LIMIT 1;

  IF v_widget_id IS NULL THEN
    INSERT INTO public.chat_widgets (
      id,
      nome,
      slug,
      projeto_id,
      agente_id,
      dominio,
      ativo,
      created_at,
      updated_at,
      tema,
      cor_primaria,
      fundo_transparente,
      whatsapp_celular
    )
    VALUES (
      uuid_generate_v4(),
      'InfraStudio Home',
      'infrastudio-home',
      v_projeto_id,
      NULL,
      NULL,
      true,
      now(),
      now(),
      'dark',
      '#2563eb',
      true,
      '5511949506267'
    );
  ELSE
    UPDATE public.chat_widgets
    SET
      nome = 'InfraStudio Home',
      projeto_id = v_projeto_id,
      ativo = true,
      updated_at = now()
    WHERE id = v_widget_id;
  END IF;
END $$;

-- Consulta rapida para conferir:
-- select id, nome, slug, projeto_id, agente_id, ativo
-- from public.chat_widgets
-- where slug = 'infrastudio-home';
