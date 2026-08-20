-- Persistência da Idempotency-Key e trava de despacho concorrente (API Store avançado)

ALTER TABLE public.integration_delivery_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS idx_integration_delivery_logs_idempotency
  ON public.integration_delivery_logs (company_id, idempotency_key, created_at DESC)
  WHERE idempotency_key IS NOT NULL;

-- No máximo um despacho "Em andamento" por (tenant, ação, entidade)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_delivery_logs_inflight
  ON public.integration_delivery_logs (company_id, action, entity_id)
  WHERE error_message = 'Em andamento' AND entity_id IS NOT NULL;

COMMENT ON COLUMN public.integration_delivery_logs.idempotency_key IS
  'SHA-256 enviado ao ERP no header Idempotency-Key (company_id:action:entity_id).';

COMMENT ON COLUMN public.integration_delivery_logs.attempts IS
  'Número sequencial da tentativa para o mesmo (company_id, action, entity_id).';
