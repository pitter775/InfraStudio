-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agente_api (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agente_id uuid NOT NULL,
  api_id uuid NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_api_pkey PRIMARY KEY (id),
  CONSTRAINT agente_api_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id),
  CONSTRAINT agente_api_api_id_fkey FOREIGN KEY (api_id) REFERENCES public.apis(id)
);
CREATE TABLE public.agentes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  nome character varying,
  descricao text,
  modelo_id uuid,
  prompt_base text,
  configuracoes jsonb,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  slug character varying,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT agentes_pkey PRIMARY KEY (id),
  CONSTRAINT agentes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id),
  CONSTRAINT agentes_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.modelos(id)
);
CREATE TABLE public.api_campos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  api_id uuid NOT NULL,
  nome character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying]::text[])),
  descricao text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_campos_pkey PRIMARY KEY (id),
  CONSTRAINT api_campos_api_id_fkey FOREIGN KEY (api_id) REFERENCES public.apis(id)
);
CREATE TABLE public.apis (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  nome character varying NOT NULL,
  url text NOT NULL,
  metodo character varying NOT NULL DEFAULT 'GET'::character varying CHECK (upper(metodo::text) = 'GET'::text),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT apis_pkey PRIMARY KEY (id),
  CONSTRAINT apis_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id)
);
CREATE TABLE public.chat_widgets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  slug character varying NOT NULL,
  projeto_id uuid,
  agente_id uuid,
  dominio text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  tema character varying NOT NULL DEFAULT 'dark'::character varying CHECK (tema::text = ANY (ARRAY['dark'::character varying, 'light'::character varying]::text[])),
  cor_primaria character varying NOT NULL DEFAULT '#2563eb'::character varying,
  fundo_transparente boolean NOT NULL DEFAULT true,
  CONSTRAINT chat_widgets_pkey PRIMARY KEY (id),
  CONSTRAINT chat_widgets_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id),
  CONSTRAINT chat_widgets_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id)
);
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  usuario_id uuid,
  titulo character varying,
  modelo_id uuid,
  contexto jsonb,
  total_tokens integer DEFAULT 0,
  total_custo numeric DEFAULT 0,
  status character varying DEFAULT 'ativo'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  agente_id uuid,
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id),
  CONSTRAINT chats_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT chats_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.modelos(id),
  CONSTRAINT chats_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id)
);
CREATE TABLE public.conectores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  agente_id uuid,
  slug character varying,
  nome character varying NOT NULL,
  tipo character varying NOT NULL,
  descricao text,
  endpoint_base text,
  metodo_auth character varying,
  configuracoes jsonb,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT conectores_pkey PRIMARY KEY (id),
  CONSTRAINT conectores_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id),
  CONSTRAINT conectores_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.agentes(id)
);
CREATE TABLE public.consumos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  usuario_id uuid,
  modelo_id uuid,
  origem character varying,
  tokens_input integer,
  tokens_output integer,
  custo_total numeric,
  referencia_id uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT consumos_pkey PRIMARY KEY (id),
  CONSTRAINT consumos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id),
  CONSTRAINT consumos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT consumos_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.modelos(id)
);
CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  tipo character varying,
  origem character varying,
  descricao text,
  payload jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id)
);
CREATE TABLE public.mensagens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid,
  role character varying NOT NULL,
  conteudo text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  custo numeric,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT mensagens_pkey PRIMARY KEY (id),
  CONSTRAINT mensagens_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.modelos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  provider character varying NOT NULL,
  custo_input numeric,
  custo_output numeric,
  ativo boolean DEFAULT true,
  configuracoes jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT modelos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.projetos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  tipo character varying,
  descricao text,
  status character varying DEFAULT 'ativo'::character varying,
  configuracoes jsonb,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  slug character varying,
  CONSTRAINT projetos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.segredos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  nome character varying,
  tipo character varying,
  valor text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT segredos_pkey PRIMARY KEY (id),
  CONSTRAINT segredos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id)
);
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying,
  email character varying UNIQUE,
  senha text,
  provider character varying,
  provider_id character varying,
  ativo boolean DEFAULT true,
  ultimo_login_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios_projetos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid,
  projeto_id uuid,
  papel character varying DEFAULT 'admin'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT usuarios_projetos_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_projetos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT usuarios_projetos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id)
);