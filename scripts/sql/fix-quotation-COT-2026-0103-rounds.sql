-- =============================================================================
-- COT-2026-0103 — Corrigir rodadas duplicadas (2 e 3 ativas fantasmas)
-- Rode APÓS aplicar migration 075 e deploy do fix do motor.
-- =============================================================================

BEGIN;

WITH q AS (
  SELECT id AS quotation_id, company_id
  FROM public.quotations
  WHERE code = 'COT-2026-0103'
  LIMIT 1
),
-- Rodada canônica = maior número fechada com propostas submitted
canonical AS (
  SELECT r.id AS round_id, r.round_number
  FROM public.quotation_rounds r
  JOIN q ON q.quotation_id = r.quotation_id
  WHERE r.status = 'closed'
    AND EXISTS (
      SELECT 1 FROM public.quotation_proposals qp
      WHERE qp.round_id = r.id AND qp.status = 'submitted'
    )
  ORDER BY r.round_number DESC
  LIMIT 1
),
-- Rodadas ativas duplicadas / vazias (exceto se for a única ativa válida)
stray_active AS (
  SELECT r.id AS round_id, r.round_number
  FROM public.quotation_rounds r
  JOIN q ON q.quotation_id = r.quotation_id
  WHERE r.status = 'active'
),
close_stray AS (
  UPDATE public.quotation_rounds r
  SET status = 'closed', closed_at = now()
  FROM stray_active s
  WHERE r.id = s.round_id
  RETURNING r.id, r.round_number
)
SELECT 'closed_stray_active' AS action, round_number, id::text FROM close_stray;

-- Reabrir a rodada canônica como ativa (se existir) para o motor continuar
WITH q AS (
  SELECT id AS quotation_id FROM public.quotations WHERE code = 'COT-2026-0103' LIMIT 1
),
canonical AS (
  SELECT r.id AS round_id, r.round_number
  FROM public.quotation_rounds r
  JOIN q ON q.quotation_id = r.quotation_id
  WHERE r.status = 'closed'
    AND EXISTS (
      SELECT 1 FROM public.quotation_proposals qp
      WHERE qp.round_id = r.id AND qp.status = 'submitted'
    )
  ORDER BY r.round_number DESC
  LIMIT 1
)
UPDATE public.quotation_rounds r
SET status = 'active', closed_at = NULL
FROM canonical c
WHERE r.id = c.round_id;

-- Sincronizar execução de negociação com a rodada canônica ativa
WITH q AS (
  SELECT id AS quotation_id, company_id FROM public.quotations WHERE code = 'COT-2026-0103' LIMIT 1
),
active AS (
  SELECT r.id, r.round_number
  FROM public.quotation_rounds r
  JOIN q ON q.quotation_id = r.quotation_id
  WHERE r.status = 'active'
  ORDER BY r.round_number DESC
  LIMIT 1
)
UPDATE public.quotation_negotiation_runs nr
SET
  status = 'waiting_deadline',
  current_round_id = active.id,
  current_round_number = active.round_number,
  tick_in_progress_at = NULL,
  last_tick_at = now(),
  updated_at = now()
FROM q, active
WHERE nr.quotation_id = q.quotation_id
  AND nr.company_id = q.company_id
  AND nr.status NOT IN ('completed', 'cancelled', 'failed');

UPDATE public.quotations q
SET status = 'waiting'
WHERE q.code = 'COT-2026-0103'
  AND q.status = 'analysis';

COMMIT;

-- Verificação
SELECT r.round_number, r.status, qp.supplier_name, qp.status AS proposal_status,
       COUNT(pi.id) AS items
FROM public.quotations q
JOIN public.quotation_rounds r ON r.quotation_id = q.id
LEFT JOIN public.quotation_proposals qp ON qp.round_id = r.id
LEFT JOIN public.proposal_items pi ON pi.proposal_id = qp.id
WHERE q.code = 'COT-2026-0103'
GROUP BY r.round_number, r.status, qp.supplier_name, qp.status
ORDER BY r.round_number, qp.supplier_name;

SELECT nr.status AS run_status, nr.current_round_number, nr.tick_in_progress_at
FROM public.quotations q
JOIN public.quotation_negotiation_runs nr ON nr.quotation_id = q.id
WHERE q.code = 'COT-2026-0103'
ORDER BY nr.created_at DESC
LIMIT 3;
