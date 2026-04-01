-- Ordem fixa dos fornecedores na equalização (convite)
ALTER TABLE public.quotation_suppliers
  ADD COLUMN IF NOT EXISTS "position" integer;

CREATE INDEX IF NOT EXISTS quotation_suppliers_quotation_position_idx
  ON public.quotation_suppliers (quotation_id, "position");
