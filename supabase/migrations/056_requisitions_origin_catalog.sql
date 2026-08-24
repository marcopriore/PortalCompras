-- Permite origin 'catalog' em requisições originadas do Catálogo de Compras

ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_origin_check;

ALTER TABLE public.requisitions ADD CONSTRAINT requisitions_origin_check
  CHECK (origin IS NULL OR origin IN ('manual', 'erp', 'catalog'));
