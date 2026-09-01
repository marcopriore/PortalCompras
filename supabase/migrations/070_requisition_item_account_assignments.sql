-- ============================================================
-- 070 — Classificação contábil por linha de requisição (SAP K/F/P/A/X + rateio)
-- Espelha 066 para requisition_items; herança REQ → PO no app.
-- ============================================================

SELECT pg_advisory_xact_lock(66070);

CREATE TABLE IF NOT EXISTS public.requisition_item_account_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requisition_item_id uuid NOT NULL,
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
  CONSTRAINT requisition_item_account_assignments_sequence_positive
    CHECK (sequence > 0),
  CONSTRAINT requisition_item_account_assignments_apportionment_range
    CHECK (apportionment_percent > 0 AND apportionment_percent <= 100),
  CONSTRAINT requisition_item_account_assignments_unique_sequence
    UNIQUE (requisition_item_id, sequence)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'requisition_item_account_assignments_item_fkey'
      AND conrelid = 'public.requisition_item_account_assignments'::regclass
  ) THEN
    ALTER TABLE public.requisition_item_account_assignments
      ADD CONSTRAINT requisition_item_account_assignments_item_fkey
      FOREIGN KEY (requisition_item_id)
      REFERENCES public.requisition_items(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.requisition_item_account_assignments
      VALIDATE CONSTRAINT requisition_item_account_assignments_item_fkey;
  END IF;
END $$;

ALTER TABLE public.requisition_items
  ADD COLUMN IF NOT EXISTS account_assignment_category text,
  ADD COLUMN IF NOT EXISTS account_assignment_distribution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS partial_invoice_distribution text DEFAULT '';

UPDATE public.requisition_items
SET
  account_assignment_distribution = COALESCE(account_assignment_distribution, ''),
  partial_invoice_distribution = COALESCE(partial_invoice_distribution, '')
WHERE
  account_assignment_distribution IS NULL
  OR partial_invoice_distribution IS NULL;

ALTER TABLE public.requisition_items
  ALTER COLUMN account_assignment_distribution SET DEFAULT '',
  ALTER COLUMN account_assignment_distribution SET NOT NULL,
  ALTER COLUMN partial_invoice_distribution SET DEFAULT '',
  ALTER COLUMN partial_invoice_distribution SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'requisition_items_account_assignment_category_check'
  ) THEN
    ALTER TABLE public.requisition_items
      ADD CONSTRAINT requisition_items_account_assignment_category_check
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
    WHERE conname = 'requisition_items_account_assignment_distribution_check'
  ) THEN
    ALTER TABLE public.requisition_items
      ADD CONSTRAINT requisition_items_account_assignment_distribution_check
      CHECK (account_assignment_distribution IN ('', '2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'requisition_items_partial_invoice_distribution_check'
  ) THEN
    ALTER TABLE public.requisition_items
      ADD CONSTRAINT requisition_items_partial_invoice_distribution_check
      CHECK (partial_invoice_distribution IN ('', '2'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_req_item_account_assignments_item
  ON public.requisition_item_account_assignments (requisition_item_id);

CREATE INDEX IF NOT EXISTS idx_req_item_account_assignments_company
  ON public.requisition_item_account_assignments (company_id);

ALTER TABLE public.requisition_item_account_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "req_item_account_assignments: tenant select"
  ON public.requisition_item_account_assignments;
CREATE POLICY "req_item_account_assignments: tenant select"
  ON public.requisition_item_account_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = requisition_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "req_item_account_assignments: tenant insert"
  ON public.requisition_item_account_assignments;
CREATE POLICY "req_item_account_assignments: tenant insert"
  ON public.requisition_item_account_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = requisition_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "req_item_account_assignments: tenant update"
  ON public.requisition_item_account_assignments;
CREATE POLICY "req_item_account_assignments: tenant update"
  ON public.requisition_item_account_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = requisition_item_account_assignments.company_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = requisition_item_account_assignments.company_id
        )
    )
  );

DROP POLICY IF EXISTS "req_item_account_assignments: tenant delete"
  ON public.requisition_item_account_assignments;
CREATE POLICY "req_item_account_assignments: tenant delete"
  ON public.requisition_item_account_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          COALESCE(p.is_superadmin, false) = true
          OR p.company_id = requisition_item_account_assignments.company_id
        )
    )
  );
