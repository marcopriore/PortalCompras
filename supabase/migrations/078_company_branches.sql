-- Centro / Filial: locais de entrega por tenant (independente de centro de custo contábil).

CREATE TABLE IF NOT EXISTS public.company_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_company_branches_company_active
  ON public.company_branches (company_id)
  WHERE active = true;

ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_manage_branches"
ON public.company_branches
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = company_branches.company_id
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
        OR p.company_id = company_branches.company_id
      )
  )
);

COMMENT ON TABLE public.company_branches IS
  'Centros / filiais de entrega do tenant (endereço por local).';

-- Filial padrão por empresa (sem dados de tenant de teste — só estrutura genérica MATRIZ).
INSERT INTO public.company_branches (company_id, code, name, active)
SELECT c.id, 'MATRIZ', COALESCE(NULLIF(trim(c.name), ''), 'Matriz'), true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_branches b
  WHERE b.company_id = c.id AND b.code = 'MATRIZ'
);

ALTER TABLE public.requisition_items
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.company_branches(id) ON DELETE RESTRICT;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.company_branches(id) ON DELETE RESTRICT;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.company_branches(id) ON DELETE RESTRICT;

ALTER TABLE public.contract_items
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.company_branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requisition_items_branch
  ON public.requisition_items (branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotation_items_branch
  ON public.quotation_items (branch_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_branch
  ON public.purchase_order_items (branch_id)
  WHERE branch_id IS NOT NULL;

-- Backfill linhas existentes com filial MATRIZ do tenant.
UPDATE public.requisition_items ri
SET branch_id = b.id
FROM public.company_branches b
WHERE ri.branch_id IS NULL
  AND b.company_id = ri.company_id
  AND b.code = 'MATRIZ';

UPDATE public.purchase_order_items poi
SET branch_id = b.id
FROM public.company_branches b
WHERE poi.branch_id IS NULL
  AND b.company_id = poi.company_id
  AND b.code = 'MATRIZ';

UPDATE public.quotation_items qi
SET branch_id = b.id
FROM public.company_branches b
WHERE qi.branch_id IS NULL
  AND b.company_id = qi.company_id
  AND b.code = 'MATRIZ';

ALTER TABLE public.requisition_items
  ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN branch_id SET NOT NULL;
