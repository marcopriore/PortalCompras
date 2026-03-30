-- Vínculo perfil fornecedor ↔ cadastro suppliers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

CREATE INDEX IF NOT EXISTS idx_profiles_supplier_id ON public.profiles(supplier_id)
  WHERE supplier_id IS NOT NULL;

-- Leitura para usuários supplier convidados nas cotações
CREATE POLICY "Supplier reads own quotation_suppliers row"
ON public.quotation_suppliers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = quotation_suppliers.supplier_id
  )
);

CREATE POLICY "Supplier reads quotations they are invited to"
ON public.quotations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.quotation_suppliers qs
      ON qs.supplier_id = p.supplier_id
     AND qs.quotation_id = quotations.id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
  )
);

CREATE POLICY "Supplier reads rounds for invited quotations"
ON public.quotation_rounds
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.quotation_suppliers qs
      ON qs.supplier_id = p.supplier_id
     AND qs.quotation_id = quotation_rounds.quotation_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
  )
);

CREATE POLICY "Supplier reads own quotation_proposals"
ON public.quotation_proposals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND quotation_proposals.supplier_id = p.supplier_id
  )
);
