-- Fase 2.2: fornecedor lê contrapropostas da cotação em que está convidado

DROP POLICY IF EXISTS "negotiation_counter_offers: supplier le proprias" ON public.negotiation_counter_offers;

CREATE POLICY "negotiation_counter_offers: supplier le proprias"
ON public.negotiation_counter_offers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.quotation_negotiation_plans np ON np.id = negotiation_counter_offers.plan_id
    JOIN public.quotation_suppliers qs
      ON qs.quotation_id = np.quotation_id
      AND qs.supplier_id = p.supplier_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND negotiation_counter_offers.company_id = np.company_id
      AND (
        negotiation_counter_offers.supplier_id IS NULL
        OR negotiation_counter_offers.supplier_id = p.supplier_id
      )
  )
);
