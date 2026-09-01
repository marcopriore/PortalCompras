-- =============================================================================
-- Helpers de teste — negociação IA (NÃO é migration)
-- Ajuste o código da cotação abaixo e rode no Supabase SQL Editor.
-- =============================================================================

-- 1) Sincronizar status da cotação quando a rodada 1 já fechou (ex.: após SQL de respostas)
UPDATE public.quotations q
SET status = 'analysis', updated_at = now()
WHERE q.code = 'COT-2026-0101'
  AND q.status = 'waiting'
  AND EXISTS (
    SELECT 1
    FROM public.quotation_rounds r
    WHERE r.quotation_id = q.id
      AND r.status = 'closed'
  );

-- 2) Expirar prazo da rodada ATIVA (simula passagem de 1+ dia sem esperar)
UPDATE public.quotation_rounds r
SET response_deadline = CURRENT_DATE - 1
FROM public.quotations q
WHERE q.id = r.quotation_id
  AND q.code = 'COT-2026-0101'
  AND r.status = 'active';

-- 3) Diagnóstico rápido
SELECT
  q.code,
  q.status AS quotation_status,
  r.round_number,
  r.status AS round_status,
  r.response_deadline,
  r.closed_at,
  nr.status AS negotiation_run_status,
  nr.current_round_number
FROM public.quotations q
LEFT JOIN public.quotation_rounds r ON r.quotation_id = q.id
LEFT JOIN public.quotation_negotiation_runs nr ON nr.quotation_id = q.id
  AND nr.status NOT IN ('completed', 'cancelled', 'failed')
WHERE q.code = 'COT-2026-0101'
ORDER BY r.round_number DESC NULLS LAST, nr.started_at DESC NULLS LAST
LIMIT 5;
