-- =============================================================================
-- COT-2026-0101 — Bootstrap rodada 1 + respostas automáticas (teste manual)
-- NÃO é migration. Rodar no Supabase SQL Editor (postgres).
-- =============================================================================

-- DIAGNÓSTICO (rode primeiro — se rodadas = 0, o script antigo não inseriu nada)
SELECT
  'quotation'::text AS entidade,
  q.id::text AS id,
  q.code::text AS detalhe,
  q.status::text AS status,
  NULL::int AS round_number,
  NULL::text AS round_status
FROM public.quotations q
WHERE q.code = 'COT-2026-0101'
UNION ALL
SELECT
  'round',
  r.id::text,
  NULL::text,
  NULL::text,
  r.round_number,
  r.status::text
FROM public.quotations q
JOIN public.quotation_rounds r ON r.quotation_id = q.id
WHERE q.code = 'COT-2026-0101'
UNION ALL
SELECT
  'supplier',
  qs.supplier_id::text,
  qs.supplier_name::text,
  NULL::text,
  NULL::int,
  NULL::text
FROM public.quotations q
JOIN public.quotation_suppliers qs ON qs.quotation_id = q.id
WHERE q.code = 'COT-2026-0101'
UNION ALL
SELECT
  'proposal',
  qp.id::text,
  qp.supplier_name::text,
  qp.status::text,
  NULL::int,
  NULL::text
FROM public.quotations q
JOIN public.quotation_proposals qp ON qp.quotation_id = q.id
WHERE q.code = 'COT-2026-0101';

BEGIN;

-- A) Bootstrap: rodada 1 + convites (se ainda não existir rodada)
WITH q AS (
  SELECT id, company_id, response_deadline
  FROM public.quotations
  WHERE code = 'COT-2026-0101'
  LIMIT 1
),
ins_round AS (
  INSERT INTO public.quotation_rounds (
    quotation_id, company_id, round_number, status, response_deadline
  )
  SELECT
    q.id,
    q.company_id,
    1,
    'active',
    COALESCE(q.response_deadline, CURRENT_DATE + 7)
  FROM q
  WHERE NOT EXISTS (
    SELECT 1 FROM public.quotation_rounds r WHERE r.quotation_id = q.id
  )
  RETURNING id AS round_id, quotation_id, company_id
),
round_ctx AS (
  SELECT r.id AS round_id, r.quotation_id, r.company_id, r.round_number
  FROM public.quotation_rounds r
  JOIN q ON q.id = r.quotation_id
  WHERE r.status = 'active'
  ORDER BY r.round_number DESC
  LIMIT 1
)
INSERT INTO public.quotation_proposals (
  quotation_id, company_id, round_id, supplier_id, supplier_name, supplier_cnpj, status
)
SELECT
  rc.quotation_id,
  rc.company_id,
  rc.round_id,
  qs.supplier_id,
  qs.supplier_name,
  qs.supplier_cnpj,
  'invited'
FROM round_ctx rc
JOIN public.quotation_suppliers qs ON qs.quotation_id = rc.quotation_id
WHERE (qs.supplier_name ILIKE '%TechParts%' OR qs.supplier_name ILIKE '%TechVision%')
  AND NOT EXISTS (
    SELECT 1 FROM public.quotation_proposals qp
    WHERE qp.round_id = rc.round_id AND qp.supplier_id = qs.supplier_id
  );

-- B) Respostas com preços (mesma lógica do script anterior)
WITH ctx AS (
  SELECT q.id AS quotation_id, q.company_id, r.id AS round_id, r.round_number
  FROM public.quotations q
  JOIN public.quotation_rounds r ON r.quotation_id = q.id
  WHERE q.code = 'COT-2026-0101' AND r.status = 'active'
  ORDER BY r.round_number DESC
  LIMIT 1
),
pay AS (
  SELECT COALESCE(
    (SELECT pc.description FROM public.payment_conditions pc
     JOIN ctx ON pc.company_id = ctx.company_id
     WHERE pc.active IS TRUE ORDER BY pc.code LIMIT 1),
    '30 dias'
  ) AS payment_condition
),
suppliers AS (
  SELECT qs.*,
    CASE
      WHEN qs.supplier_name ILIKE '%TechParts%' THEN 1
      WHEN qs.supplier_name ILIKE '%TechVision%' THEN 2
      ELSE 99
    END AS slot
  FROM public.quotation_suppliers qs
  JOIN ctx ON ctx.quotation_id = qs.quotation_id
  WHERE qs.supplier_name ILIKE '%TechParts%' OR qs.supplier_name ILIKE '%TechVision%'
),
items AS (
  SELECT qi.id AS quotation_item_id, qi.quantity::numeric AS quantity, qi.company_id,
    ROW_NUMBER() OVER (ORDER BY qi.material_code) AS rn,
    COALESCE(it.target_price, it.last_purchase_price, it.average_price,
      12 + ROW_NUMBER() OVER (ORDER BY qi.material_code) * 3.25)::numeric AS ref_price
  FROM public.quotation_items qi
  JOIN ctx ON ctx.quotation_id = qi.quotation_id
  LEFT JOIN public.items it ON it.company_id = qi.company_id AND it.code = qi.material_code
),
priced AS (
  SELECT s.supplier_id, s.supplier_name, s.supplier_cnpj, s.company_id, s.slot,
    i.quotation_item_id, i.quantity,
    ROUND(i.ref_price * CASE s.slot WHEN 1 THEN 0.96 WHEN 2 THEN 1.06 ELSE 1 END
      * (1 - GREATEST(0, (SELECT round_number FROM ctx) - 1) * 0.015), 2) AS unit_price,
    CASE s.slot WHEN 1 THEN 7 WHEN 2 THEN 10 ELSE 8 END + (i.rn % 4) AS delivery_days
  FROM suppliers s CROSS JOIN items i
),
upsert_proposals AS (
  INSERT INTO public.quotation_proposals (
    quotation_id, company_id, round_id, supplier_id, supplier_name, supplier_cnpj,
    status, payment_condition, validity_date, delivery_days, observations, total_price
  )
  SELECT ctx.quotation_id, ctx.company_id, ctx.round_id, p.supplier_id, p.supplier_name,
    p.supplier_cnpj, 'invited', pay.payment_condition, (CURRENT_DATE + 30)::date,
    MAX(p.delivery_days),
    CASE p.slot WHEN 1 THEN 'Proposta automática (teste) — TechParts'
                WHEN 2 THEN 'Proposta automática (teste) — TechVision'
                ELSE 'Proposta automática (teste)' END,
    ROUND(SUM(p.unit_price * p.quantity), 2)
  FROM priced p CROSS JOIN ctx CROSS JOIN pay
  GROUP BY ctx.quotation_id, ctx.company_id, ctx.round_id, p.supplier_id, p.supplier_name,
           p.supplier_cnpj, p.slot, pay.payment_condition
  ON CONFLICT (quotation_id, supplier_id, round_id) DO UPDATE SET
    payment_condition = EXCLUDED.payment_condition,
    validity_date = EXCLUDED.validity_date,
    delivery_days = EXCLUDED.delivery_days,
    observations = EXCLUDED.observations,
    total_price = EXCLUDED.total_price,
    updated_at = now()
  RETURNING id, supplier_id, round_id
)
INSERT INTO public.proposal_items (
  proposal_id, quotation_item_id, round_id, company_id,
  unit_price, tax_percent, delivery_days, item_status
)
SELECT up.id, p.quotation_item_id, up.round_id, p.company_id,
  p.unit_price, 0, p.delivery_days, 'accepted'
FROM priced p
JOIN upsert_proposals up ON up.supplier_id = p.supplier_id
ON CONFLICT (proposal_id, quotation_item_id) DO UPDATE SET
  unit_price = EXCLUDED.unit_price,
  delivery_days = EXCLUDED.delivery_days,
  item_status = EXCLUDED.item_status,
  round_id = EXCLUDED.round_id;

WITH ctx AS (
  SELECT r.id AS round_id
  FROM public.quotations q
  JOIN public.quotation_rounds r ON r.quotation_id = q.id
  WHERE q.code = 'COT-2026-0101' AND r.status = 'active'
  ORDER BY r.round_number DESC
  LIMIT 1
),
targets AS (
  SELECT qp.id
  FROM public.quotation_proposals qp
  JOIN ctx ON ctx.round_id = qp.round_id
  JOIN public.quotation_suppliers qs
    ON qs.quotation_id = qp.quotation_id AND qs.supplier_id = qp.supplier_id
  WHERE qs.supplier_name ILIKE '%TechParts%' OR qs.supplier_name ILIKE '%TechVision%'
)
UPDATE public.quotation_proposals qp
SET status = 'submitted', updated_at = now()
FROM targets t
WHERE qp.id = t.id AND qp.status IS DISTINCT FROM 'submitted';

COMMIT;

-- Resultado
SELECT q.code, r.round_number, r.status AS round_status, qp.supplier_name, qp.status, qp.total_price,
       COUNT(pi.id) AS items
FROM public.quotations q
JOIN public.quotation_rounds r ON r.quotation_id = q.id
JOIN public.quotation_proposals qp ON qp.round_id = r.id
LEFT JOIN public.proposal_items pi ON pi.proposal_id = qp.id
WHERE q.code = 'COT-2026-0101'
GROUP BY 1,2,3,4,5,6
ORDER BY r.round_number DESC, qp.supplier_name;
