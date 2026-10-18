-- 085: restaurar RLS do portal fornecedor na cotação
-- 073 substituiu políticas "same company" por buyer-only em quotation_items,
-- quotation_proposals, proposal_items e suppliers, sem devolver SELECT/INSERT/UPDATE
-- ao fornecedor. O portal (/fornecedor/cotacoes/[id] e /fornecedor/perfil) usa o
-- client JWT — sem estas policies o fornecedor não carrega itens nem grava proposta.

-- ------------------------------------------------------------
-- suppliers: ler o próprio cadastro (perfil + cabeçalho da cotação)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier reads own supplier row" ON public.suppliers;
CREATE POLICY "Supplier reads own supplier row"
ON public.suppliers
FOR SELECT
TO authenticated
USING (id = public.get_my_supplier_id());

-- ------------------------------------------------------------
-- supplier_categories: ler categorias do próprio fornecedor
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier reads own supplier_categories" ON public.supplier_categories;
CREATE POLICY "Supplier reads own supplier_categories"
ON public.supplier_categories
FOR SELECT
TO authenticated
USING (supplier_id = public.get_my_supplier_id());

-- ------------------------------------------------------------
-- quotation_items: ler itens das cotações em que está convidado
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier reads quotation_items of invited quotations"
  ON public.quotation_items;
CREATE POLICY "Supplier reads quotation_items of invited quotations"
ON public.quotation_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.quotation_suppliers qs
      ON qs.supplier_id = p.supplier_id
     AND qs.quotation_id = quotation_items.quotation_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
  )
);

-- ------------------------------------------------------------
-- quotation_proposals: gravar a própria proposta (rascunho / envio)
-- Não permite status de decisão do comprador (selected / rejected).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier inserts own quotation_proposals" ON public.quotation_proposals;
CREATE POLICY "Supplier inserts own quotation_proposals"
ON public.quotation_proposals
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id = public.get_my_supplier_id()
  AND status IN ('invited', 'submitted')
  AND EXISTS (
    SELECT 1
    FROM public.quotation_suppliers qs
    WHERE qs.quotation_id = quotation_proposals.quotation_id
      AND qs.supplier_id = quotation_proposals.supplier_id
  )
);

DROP POLICY IF EXISTS "Supplier updates own quotation_proposals" ON public.quotation_proposals;
CREATE POLICY "Supplier updates own quotation_proposals"
ON public.quotation_proposals
FOR UPDATE
TO authenticated
USING (
  supplier_id = public.get_my_supplier_id()
  AND status IN ('invited', 'submitted')
)
WITH CHECK (
  supplier_id = public.get_my_supplier_id()
  AND status IN ('invited', 'submitted')
);

-- ------------------------------------------------------------
-- proposal_items: ler/gravar linhas da própria proposta
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Supplier reads own proposal_items" ON public.proposal_items;
CREATE POLICY "Supplier reads own proposal_items"
ON public.proposal_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quotation_proposals qp
    WHERE qp.id = proposal_items.proposal_id
      AND qp.supplier_id = public.get_my_supplier_id()
  )
);

DROP POLICY IF EXISTS "Supplier inserts own proposal_items" ON public.proposal_items;
CREATE POLICY "Supplier inserts own proposal_items"
ON public.proposal_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotation_proposals qp
    INNER JOIN public.quotation_items qi
      ON qi.id = proposal_items.quotation_item_id
     AND qi.quotation_id = qp.quotation_id
    WHERE qp.id = proposal_items.proposal_id
      AND qp.supplier_id = public.get_my_supplier_id()
      AND qp.status IN ('invited', 'submitted')
  )
);

DROP POLICY IF EXISTS "Supplier updates own proposal_items" ON public.proposal_items;
CREATE POLICY "Supplier updates own proposal_items"
ON public.proposal_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quotation_proposals qp
    WHERE qp.id = proposal_items.proposal_id
      AND qp.supplier_id = public.get_my_supplier_id()
      AND qp.status IN ('invited', 'submitted')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotation_proposals qp
    INNER JOIN public.quotation_items qi
      ON qi.id = proposal_items.quotation_item_id
     AND qi.quotation_id = qp.quotation_id
    WHERE qp.id = proposal_items.proposal_id
      AND qp.supplier_id = public.get_my_supplier_id()
      AND qp.status IN ('invited', 'submitted')
  )
);
