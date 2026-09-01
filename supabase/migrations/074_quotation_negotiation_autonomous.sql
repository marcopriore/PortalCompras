-- ============================================================
-- 074 — Negociação assistida por IA (plano + execução + auditoria)
-- Fase 2.1: plano configurável, motor de rodadas, logs de decisão.
-- Sem dados de teste (PRD).
-- ============================================================

SELECT pg_advisory_xact_lock(66074);

-- ------------------------------------------------------------
-- quotation_negotiation_plans
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_negotiation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  min_rounds integer NOT NULL DEFAULT 3
    CHECK (min_rounds >= 1 AND min_rounds <= 20),
  max_rounds integer NOT NULL DEFAULT 5
    CHECK (max_rounds >= 1 AND max_rounds <= 30),
  max_price_pct_above_best numeric(7, 3) NOT NULL DEFAULT 5
    CHECK (max_price_pct_above_best >= 0 AND max_price_pct_above_best <= 100),
  target_saving_pct_below_target numeric(7, 3) NOT NULL DEFAULT 15
    CHECK (target_saving_pct_below_target >= 0 AND target_saving_pct_below_target <= 100),
  stop_on_target boolean NOT NULL DEFAULT true,
  stop_on_no_improvement boolean NOT NULL DEFAULT true,
  strategy text NOT NULL DEFAULT 'per_item'
    CHECK (strategy IN ('per_item', 'per_supplier', 'by_category', 'by_cost_center')),
  require_buyer_approval boolean NOT NULL DEFAULT true,
  response_deadline_days integer NOT NULL DEFAULT 5
    CHECK (response_deadline_days >= 1 AND response_deadline_days <= 60),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT quotation_negotiation_plans_max_gte_min
    CHECK (max_rounds >= min_rounds)
);

CREATE INDEX IF NOT EXISTS idx_quotation_negotiation_plans_quotation
  ON public.quotation_negotiation_plans (quotation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_negotiation_plans_company_status
  ON public.quotation_negotiation_plans (company_id, status);

-- ------------------------------------------------------------
-- quotation_negotiation_runs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_negotiation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.quotation_negotiation_plans(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'running', 'waiting_deadline', 'analyzing',
      'opening_round', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled'
    )),
  current_round_number integer NOT NULL DEFAULT 0,
  current_round_id uuid REFERENCES public.quotation_rounds(id) ON DELETE SET NULL,
  rounds_opened integer NOT NULL DEFAULT 0,
  last_improvement_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  last_tick_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_negotiation_runs_plan
  ON public.quotation_negotiation_runs (plan_id);

CREATE INDEX IF NOT EXISTS idx_quotation_negotiation_runs_quotation
  ON public.quotation_negotiation_runs (quotation_id, status);

-- ------------------------------------------------------------
-- negotiation_counter_offers (Fase 2.2 — estrutura pronta)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negotiation_counter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.quotation_negotiation_plans(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.quotation_negotiation_runs(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.quotation_rounds(id) ON DELETE SET NULL,
  quotation_item_id uuid NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  target_unit_price numeric(18, 6) NOT NULL CHECK (target_unit_price >= 0),
  current_best_unit_price numeric(18, 6),
  rationale text,
  source text NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'buyer', 'system')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_counter_offers_run
  ON public.negotiation_counter_offers (run_id, round_id);

-- ------------------------------------------------------------
-- negotiation_decision_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negotiation_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.quotation_negotiation_plans(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.quotation_negotiation_runs(id) ON DELETE SET NULL,
  round_id uuid REFERENCES public.quotation_rounds(id) ON DELETE SET NULL,
  decision_type text NOT NULL DEFAULT 'system'
    CHECK (decision_type IN ('system', 'ai', 'buyer')),
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_decision_logs_run
  ON public.negotiation_decision_logs (run_id, created_at DESC);

-- ------------------------------------------------------------
-- RLS (buyer tenant + superadmin)
-- ------------------------------------------------------------
ALTER TABLE public.quotation_negotiation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_negotiation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_counter_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_decision_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_negotiation_plans: buyer gerencia tenant" ON public.quotation_negotiation_plans;
CREATE POLICY "quotation_negotiation_plans: buyer gerencia tenant"
ON public.quotation_negotiation_plans FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = quotation_negotiation_plans.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = quotation_negotiation_plans.company_id)
  )
);

DROP POLICY IF EXISTS "quotation_negotiation_runs: buyer gerencia tenant" ON public.quotation_negotiation_runs;
CREATE POLICY "quotation_negotiation_runs: buyer gerencia tenant"
ON public.quotation_negotiation_runs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = quotation_negotiation_runs.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = quotation_negotiation_runs.company_id)
  )
);

DROP POLICY IF EXISTS "negotiation_counter_offers: buyer gerencia tenant" ON public.negotiation_counter_offers;
CREATE POLICY "negotiation_counter_offers: buyer gerencia tenant"
ON public.negotiation_counter_offers FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = negotiation_counter_offers.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = negotiation_counter_offers.company_id)
  )
);

DROP POLICY IF EXISTS "negotiation_decision_logs: buyer gerencia tenant" ON public.negotiation_decision_logs;
CREATE POLICY "negotiation_decision_logs: buyer gerencia tenant"
ON public.negotiation_decision_logs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = negotiation_decision_logs.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_type = 'buyer'
      AND (COALESCE(p.is_superadmin, false) OR p.company_id = negotiation_decision_logs.company_id)
  )
);

COMMENT ON TABLE public.quotation_negotiation_plans IS
  'Parâmetros do evento de negociação assistida por IA (premium ai_negotiation_autonomous).';

COMMENT ON TABLE public.quotation_negotiation_runs IS
  'Execução do plano: estado do motor, rodada atual e métricas agregadas.';
