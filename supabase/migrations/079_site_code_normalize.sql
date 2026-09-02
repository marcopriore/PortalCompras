-- Normaliza centro/filial: linhas usam site_code (código do cadastro company_branches).

ALTER TABLE public.requisition_items
  ADD COLUMN IF NOT EXISTS site_code text;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS site_code text;

ALTER TABLE public.contract_items
  ADD COLUMN IF NOT EXISTS site_code text;

-- purchase_order_items.site_code já existe (066)

UPDATE public.requisition_items ri
SET site_code = b.code
FROM public.company_branches b
WHERE ri.branch_id = b.id
  AND (ri.site_code IS NULL OR trim(ri.site_code) = '');

UPDATE public.quotation_items qi
SET site_code = b.code
FROM public.company_branches b
WHERE qi.branch_id = b.id
  AND (qi.site_code IS NULL OR trim(qi.site_code) = '');

UPDATE public.contract_items ci
SET site_code = b.code
FROM public.company_branches b
WHERE ci.branch_id = b.id
  AND (ci.site_code IS NULL OR trim(ci.site_code) = '');

UPDATE public.purchase_order_items poi
SET site_code = b.code
FROM public.company_branches b
WHERE poi.branch_id = b.id
  AND (poi.site_code IS NULL OR trim(poi.site_code) = '');

ALTER TABLE public.requisition_items
  DROP CONSTRAINT IF EXISTS requisition_items_branch_id_fkey;

ALTER TABLE public.quotation_items
  DROP CONSTRAINT IF EXISTS quotation_items_branch_id_fkey;

ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_branch_id_fkey;

ALTER TABLE public.contract_items
  DROP CONSTRAINT IF EXISTS contract_items_branch_id_fkey;

DROP INDEX IF EXISTS public.idx_requisition_items_branch;
DROP INDEX IF EXISTS public.idx_quotation_items_branch;
DROP INDEX IF EXISTS public.idx_purchase_order_items_branch;

ALTER TABLE public.requisition_items DROP COLUMN IF EXISTS branch_id;
ALTER TABLE public.quotation_items DROP COLUMN IF EXISTS branch_id;
ALTER TABLE public.purchase_order_items DROP COLUMN IF EXISTS branch_id;
ALTER TABLE public.contract_items DROP COLUMN IF EXISTS branch_id;

ALTER TABLE public.requisition_items
  ALTER COLUMN site_code SET NOT NULL;

ALTER TABLE public.quotation_items
  ALTER COLUMN site_code SET NOT NULL;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN site_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requisition_items_site_code
  ON public.requisition_items (company_id, site_code);

CREATE INDEX IF NOT EXISTS idx_quotation_items_site_code
  ON public.quotation_items (company_id, site_code);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_site_code
  ON public.purchase_order_items (company_id, site_code);

CREATE INDEX IF NOT EXISTS idx_contract_items_site_code
  ON public.contract_items (company_id, site_code)
  WHERE site_code IS NOT NULL;

ALTER TABLE public.requisition_items
  DROP CONSTRAINT IF EXISTS requisition_items_site_code_fkey;

ALTER TABLE public.quotation_items
  DROP CONSTRAINT IF EXISTS quotation_items_site_code_fkey;

ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_site_code_fkey;

ALTER TABLE public.contract_items
  DROP CONSTRAINT IF EXISTS contract_items_site_code_fkey;

ALTER TABLE public.requisition_items
  ADD CONSTRAINT requisition_items_site_code_fkey
  FOREIGN KEY (company_id, site_code)
  REFERENCES public.company_branches (company_id, code)
  ON DELETE RESTRICT;

ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_site_code_fkey
  FOREIGN KEY (company_id, site_code)
  REFERENCES public.company_branches (company_id, code)
  ON DELETE RESTRICT;

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_site_code_fkey
  FOREIGN KEY (company_id, site_code)
  REFERENCES public.company_branches (company_id, code)
  ON DELETE RESTRICT;

ALTER TABLE public.contract_items
  ADD CONSTRAINT contract_items_site_code_fkey
  FOREIGN KEY (company_id, site_code)
  REFERENCES public.company_branches (company_id, code)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.requisition_items.site_code IS
  'Código do centro/filial de entrega (company_branches.code).';
COMMENT ON COLUMN public.quotation_items.site_code IS
  'Código do centro/filial de entrega (company_branches.code).';
COMMENT ON COLUMN public.purchase_order_items.site_code IS
  'Código do centro/filial de entrega (company_branches.code).';
COMMENT ON COLUMN public.contract_items.site_code IS
  'Código do centro/filial de entrega (company_branches.code); opcional.';
