-- Seed do agente da home da InfraStudio.
-- Nao altera schema. Apenas cria/atualiza:
-- 1) o agente da home
-- 2) o vinculo dele com o widget 'infrastudio-home'
--
-- Pre-requisitos:
-- - existir projeto com slug = 'infrastudio'
-- - idealmente executar antes o arquivo:
--   database/home-chat-widget-seed.sql

DO $$
DECLARE
  v_projeto_id uuid;
  v_agente_id uuid;
  v_widget_id uuid;
  v_prompt text;
  v_config jsonb;
BEGIN
  SELECT id
  INTO v_projeto_id
  FROM public.projetos
  WHERE slug = 'infrastudio'
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'Projeto com slug "infrastudio" nao encontrado.';
  END IF;

  v_prompt := $prompt$
Voce e o agente oficial da home da InfraStudio.

Seu papel e conduzir um primeiro atendimento comercial com clareza, objetividade e linguagem natural.

Objetivos principais:
- entender rapidamente o que a pessoa quer automatizar ou construir
- sugerir o melhor encaixe inicial da InfraStudio
- organizar a resposta com boa legibilidade
- conduzir para WhatsApp quando houver interesse comercial

Regras de resposta:
- evite blocos longos de texto corrido
- prefira respostas curtas, escaneaveis e bem separadas
- quando fizer sentido, use listas curtas
- destaque pontos-chave com negrito
- nao invente funcionalidades ou precos fora do que estiver disponivel no contexto
- se faltar contexto, faca 1 pergunta curta por vez
- quando houver fit, convide a continuar no WhatsApp

Temas comuns da home:
- sistemas sob medida
- automacao de processos
- integracao de APIs
- chat com IA
- automacao no WhatsApp
- CRM, atendimento e operacao comercial
$prompt$;

  v_config := jsonb_build_object(
    'handoff', jsonb_build_object(
      'enviar_para_humano_se', jsonb_build_array(
        'o usuario pedir proposta ou orcamento formal',
        'o usuario quiser fechar ou avancar comercialmente',
        'o usuario pedir atendimento humano direto'
      )
    ),
    'objetivo', 'Atender visitantes da home da InfraStudio e encaminhar oportunidades qualificadas.',
    'capacidade', jsonb_build_array(
      'qualificar demanda inicial',
      'explicar servicos da InfraStudio',
      'orientar proximo passo comercial',
      'encaminhar para WhatsApp'
    ),
    'canal', 'home_chat_widget'
  );

  SELECT id
  INTO v_agente_id
  FROM public.agentes
  WHERE projeto_id = v_projeto_id
    AND slug = 'home-infrastudio'
  LIMIT 1;

  IF v_agente_id IS NULL THEN
    INSERT INTO public.agentes (
      id,
      projeto_id,
      nome,
      descricao,
      modelo_id,
      prompt_base,
      configuracoes,
      ativo,
      slug,
      created_at,
      updated_at
    )
    VALUES (
      uuid_generate_v4(),
      v_projeto_id,
      'Agente Home InfraStudio',
      'Agente comercial da home da InfraStudio para triagem, qualificacao e direcionamento inicial.',
      NULL,
      v_prompt,
      v_config,
      true,
      'home-infrastudio',
      now(),
      now()
    )
    RETURNING id INTO v_agente_id;
  ELSE
    UPDATE public.agentes
    SET
      nome = 'Agente Home InfraStudio',
      descricao = 'Agente comercial da home da InfraStudio para triagem, qualificacao e direcionamento inicial.',
      prompt_base = v_prompt,
      configuracoes = v_config,
      ativo = true,
      updated_at = now()
    WHERE id = v_agente_id;
  END IF;

  SELECT id
  INTO v_widget_id
  FROM public.chat_widgets
  WHERE slug = 'infrastudio-home'
  LIMIT 1;

  IF v_widget_id IS NOT NULL THEN
    UPDATE public.chat_widgets
    SET
      projeto_id = v_projeto_id,
      agente_id = v_agente_id,
      ativo = true,
      updated_at = now()
    WHERE id = v_widget_id;
  END IF;
END $$;

-- Consultas rapidas:
-- select id, slug, nome, ativo from public.agentes where slug = 'home-infrastudio';
-- select id, slug, projeto_id, agente_id, ativo from public.chat_widgets where slug = 'infrastudio-home';
