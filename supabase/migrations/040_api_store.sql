-- Migration 040: Loja de API — chaves, logs inbound, endpoints outbound (ERP), external_code

-- Referência do sistema externo (ERP) — obrigatório na integração inbound de requisições
ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS external_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_requisitions_company_external_code
  ON public.requisitions (company_id, external_code)
  WHERE external_code IS NOT NULL;

-- Código atribuído pelo ERP após criação do pedido (resposta do POST outbound)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS external_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_company_external_code
  ON public.purchase_orders (company_id, external_code)
  WHERE external_code IS NOT NULL;

-- Chaves de API (inbound: Externo → Valore)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_active
  ON public.api_keys (key_prefix)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_api_keys_company
  ON public.api_keys (company_id);

-- Log de requisições inbound
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer,
  duration_ms integer,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_company_created
  ON public.api_request_logs (company_id, created_at DESC);

-- Endpoints de integração outbound (Valore → ERP) — HTTP ativo com resposta sucesso/falha
CREATE TABLE IF NOT EXISTS public.integration_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  auth_type text NOT NULL DEFAULT 'none'
    CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key_header')),
  auth_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  timeout_ms integer NOT NULL DEFAULT 30000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_endpoints_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_integration_endpoints_company_active
  ON public.integration_endpoints (company_id)
  WHERE active = true;

-- Log de entregas outbound (integração executada + resposta do ERP)
CREATE TABLE IF NOT EXISTS public.integration_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES public.integration_endpoints(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  entity_code text,
  request_payload jsonb,
  response_status integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_company_created
  ON public.integration_delivery_logs (company_id, created_at DESC);

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Admin do tenant gerencia chaves e endpoints
CREATE POLICY "api_keys: tenant admin manage"
ON public.api_keys
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = api_keys.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = api_keys.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
);

CREATE POLICY "api_request_logs: tenant admin read"
ON public.api_request_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = api_request_logs.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
);

CREATE POLICY "integration_endpoints: tenant admin manage"
ON public.integration_endpoints
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = integration_endpoints.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = integration_endpoints.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
);

CREATE POLICY "integration_delivery_logs: tenant admin read"
ON public.integration_delivery_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = integration_delivery_logs.company_id
      AND (
        p.role = 'admin'
        OR (p.roles IS NOT NULL AND 'admin' = ANY (p.roles))
      )
  )
);

-- Feature premium Loja de API (empresa teste)
INSERT INTO public.tenant_features (company_id, feature_key, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'api_integrations', true)
ON CONFLICT (company_id, feature_key) DO NOTHING;
