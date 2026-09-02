-- ============================================================
-- 075 — Lock de tick na negociação assistida (evita rodadas duplicadas)
-- ============================================================

SELECT pg_advisory_xact_lock(66075);

ALTER TABLE public.quotation_negotiation_runs
  ADD COLUMN IF NOT EXISTS tick_in_progress_at timestamptz;

COMMENT ON COLUMN public.quotation_negotiation_runs.tick_in_progress_at IS
  'Claim exclusivo para tick do motor; evita abertura concorrente de rodadas.';
