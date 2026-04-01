-- Condições de pagamento por tenant (comprador) + leitura para fornecedores convidados

CREATE OR REPLACE FUNCTION public.get_my_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT p.supplier_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.payment_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, code)
);

ALTER TABLE public.payment_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_manage_payment_conditions"
ON public.payment_conditions FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "supplier_read_payment_conditions"
ON public.payment_conditions FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT q.company_id FROM public.quotations q
    INNER JOIN public.quotation_suppliers qs ON qs.quotation_id = q.id
    WHERE qs.supplier_id = public.get_my_supplier_id()
  )
);
