DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.canais_whatsapp
    GROUP BY projeto_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existe mais de um canal WhatsApp em pelo menos um projeto. Ajuste os dados antes de aplicar a restricao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conectores
    WHERE tipo = 'mercado_livre'
    GROUP BY projeto_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existe mais de uma integracao Mercado Livre em pelo menos um projeto. Ajuste os dados antes de aplicar a restricao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chat_widgets
    WHERE agente_id IS NOT NULL
    GROUP BY projeto_id, agente_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existe mais de um widget vinculado ao mesmo agente em pelo menos um projeto. Ajuste os dados antes de aplicar a restricao.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS canais_whatsapp_one_per_project_idx
  ON public.canais_whatsapp (projeto_id);

CREATE UNIQUE INDEX IF NOT EXISTS conectores_mercado_livre_one_per_project_idx
  ON public.conectores (projeto_id)
  WHERE tipo = 'mercado_livre';

CREATE UNIQUE INDEX IF NOT EXISTS chat_widgets_one_per_project_agent_idx
  ON public.chat_widgets (projeto_id, agente_id)
  WHERE agente_id IS NOT NULL;
