-- ============================================================
-- 066 — Classificação contábil por linha de pedido (SAP K/F/P/A/X + rateio)
--
-- Ordem pensada para reduzir deadlock:
-- 1) tabela filha sem FK (sem lock exclusivo prolongado no pai)
-- 2) colunas no pai
-- 3) FK / índices / RLS / policies
-- Idempotente para retry seguro após falha.
-- ============================================================

-- Serializa execuções concorrentes desta migration (ex.: SQL Editor + CLI ao mesmo tempo).
SELECT pg_advisory_xact_lock(66066);

-- 1. Tabela de rateio (sem FK inicial — evita disputa de lock com ALTER no pai)
CREATE TABLE IF NOT EXISTS public.purchase_order_item_account_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  apportionment_percent numeric(7, 3) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  ledger_account_code text,
  business_area text,
  controlling_area text,
  cost_center_code text,
  internal_order_id text,
  wbs_element text,
  asset_number text,
  profit_center text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_item_account_assignments_sequence_positive
    CHECK (sequence > 0),
  CONSTRAINT purchase_order_item_account_assignments_apportionment_range
    CHECK (apportionment_percent > 0 AND apportionment_percent <= 100),
  CONSTRAINT purchase_order_item_account_assignments_unique_sequence
    UNIQUE (purchase_order_item_id, sequence)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_order_item_account_assignments_item_fkey'
      AND conrelid = 'public.purchase_order_item_account_assignments'::regclass
  ) THEN
    ALTER TABLE public.purchase_order_item_account_assignments
      ADD CONSTRAINT purchase_order_item_account_assignments_item_fkey
      FOREIGN KEY (purchase_order_item_id)
      REFERENCES public.purchase_order_items(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.purchase_order_item_account_assignments
      VALIDATE CONSTRAINT purchase_order_item_account_assignments_item_fkey;
  END IF;
END $$;

-- 2. Colunas de classificação no item do pedido
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS account_assignment_category text,
  ADD COLUMN IF NOT EXISTS account_assignment_distribution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS partial_invoice_distribution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_code text,
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS goods_receipt_expected boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS incoterms_code text,
  ADD COLUMN IF NOT EXISTS incoterms_local text,
  ADD COLUMN IF NOT EXISTS performance_period_start_date date,
  ADD COLUMN IF NOT EXISTS performance_period_end_date date,
  ADD COLUMN IF NOT EXISTS schedule_line_delivery_date date,
  ADD COLUMN IF NOT EXISTS sap_item_extensions jsonb DEFAULT '{}'::jsonb;

UPDATE public.purchase_order_items
SET
  account_assignment_distribution = COALESCE(account_assignment_distribution, ''),
  partial_invoice_distribution = COALESCE(partial_invoice_distribution, ''),
  goods_receipt_expected = COALESCE(goods_receipt_expected, true),
  sap_item_extensions = COALESCE(sap_item_extensions, '{}'::jsonb)
WHERE
  account_assignment_distribution IS NULL
  OR partial_invoice_distribution IS NULL
  OR goods_receipt_expected IS NULL
  OR sap_item_extensions IS NULL;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN account_assignment_distribution SET DEFAULT '',
  ALTER COLUMN account_assignment_distribution SET NOT NULL,
  ALTER COLUMN partial_invoice_distribution SET DEFAULT '',
  ALTER COLUMN partial_invoice_distribution SET NOT NULL,
  ALTER COLUMN goods_receipt_expected SET DEFAULT true,
  ALTER COLUMN goods_receipt_expected SET NOT NULL,
  ALTER COLUMN sap_item_extensions SET DEFAULT '{}'::jsonb,
  ALTER COLUMN sap_item_extensions SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_order_items_account_assignment_category_check'
  ) THEN
    ALTER TABLE public.purchase_order_items
      ADD CONSTRAINT purchase_order_items_account_assignment_category_check
      CHECK (
        account_assignment_category IS NULL
        OR account_assignment_category = ANY (
          ARRAY['K'::text, 'F'::text, 'P'::text, 'A'::text, 'X'::text]
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_order_items_account_assignment_distribution_check'
  ) THEN
    ALTER TABLE public.purchase_order_items
      ADD CONSTRAINT purchase_order_items_account_assignment_distribution_check
      CHECK (account_assignment_distribution IN ('', '2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_order_items_partial_invoice_distribution_check'
  ) THEN
    ALTER TABLE public.purchase_order_items
      ADD CONSTRAINT purchase_order_items_partial_invoice_distribution_check
      CHECK (partial_invoice_distribution IN ('', '2'));
  END IF;
END $$;

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_po_item_account_assignments_item
  ON public.purchase_order_item_account_assignments (purchase_order_item_id);

CREATE INDEX IF NOT EXISTS idx_po_item_account_assignments_company
  ON public.purchase_order_item_account_assignments (company_id);

-- 4. RLS
ALTER TABLE public.purchase_order_item_account_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_item_account_assignments: tenant select"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant select"
  ON public.purchase_order_item_account_assignments FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant insert"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant insert"
  ON public.purchase_order_item_account_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant update"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant update"
  ON public.purchase_order_item_account_assignments FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "po_item_account_assignments: tenant delete"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: tenant delete"
  ON public.purchase_order_item_account_assignments FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "po_item_account_assignments: supplier select"
  ON public.purchase_order_item_account_assignments;
CREATE POLICY "po_item_account_assignments: supplier select"
  ON public.purchase_order_item_account_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      INNER JOIN public.purchase_order_items poi
        ON poi.id = purchase_order_item_account_assignments.purchase_order_item_id
      INNER JOIN public.purchase_orders po
        ON po.id = poi.purchase_order_id
      WHERE p.id = auth.uid()
        AND p.profile_type = 'supplier'
        AND p.supplier_id IS NOT NULL
        AND po.supplier_id = p.supplier_id
    )
  );
