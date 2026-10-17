-- ============================================================
-- 088 — classificação contábil: fornecedor não altera rateio
--
-- 066/068 (PO) e 070 (REQ) liberavam SELECT/INSERT/UPDATE/DELETE
-- para qualquer profile com o mesmo company_id. Sessão do portal
-- fornecedor (profiles.company_id = tenant comprador) podia
-- apagar ou trocar centro de custo / conta / PEP nas linhas.
--
-- Impacto: outbound ERP (account_assignments) posta classificação
-- errada; rateio do pedido/requisição é corrompido.
--
-- PO: escrita buyer (+ superadmin). SELECT do fornecedor do pedido
--     (066 "po_item_account_assignments: supplier select") permanece.
-- REQ: buyer no tenant; requester só nas próprias linhas.
-- Catalog checkout usa service role — inalterado.
-- ============================================================

-- ------------------------------------------------------------
-- purchase_order_item_account_assignments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "po_item_account_assignments: tenant select"
  ON public.purchase_order_item_account_assignments;
DROP POLICY IF EXISTS "po_item_account_assignments: tenant insert"
  ON public.purchase_order_item_account_assignments;
DROP POLICY IF EXISTS "po_item_account_assignments: tenant update"
  ON public.purchase_order_item_account_assignments;
DROP POLICY IF EXISTS "po_item_account_assignments: tenant delete"
  ON public.purchase_order_item_account_assignments;
DROP POLICY IF EXISTS "po_item_account_assignments: buyer gerencia tenant"
  ON public.purchase_order_item_account_assignments;

CREATE POLICY "po_item_account_assignments: buyer gerencia tenant"
ON public.purchase_order_item_account_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = purchase_order_item_account_assignments.company_id
          AND p.profile_type = 'buyer'
        )
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
        OR (
          p.company_id = purchase_order_item_account_assignments.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

-- ------------------------------------------------------------
-- requisition_item_account_assignments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "req_item_account_assignments: tenant select"
  ON public.requisition_item_account_assignments;
DROP POLICY IF EXISTS "req_item_account_assignments: tenant insert"
  ON public.requisition_item_account_assignments;
DROP POLICY IF EXISTS "req_item_account_assignments: tenant update"
  ON public.requisition_item_account_assignments;
DROP POLICY IF EXISTS "req_item_account_assignments: tenant delete"
  ON public.requisition_item_account_assignments;
DROP POLICY IF EXISTS "req_item_account_assignments: buyer gerencia tenant"
  ON public.requisition_item_account_assignments;
DROP POLICY IF EXISTS "req_item_account_assignments: requester own"
  ON public.requisition_item_account_assignments;

CREATE POLICY "req_item_account_assignments: buyer gerencia tenant"
ON public.requisition_item_account_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = requisition_item_account_assignments.company_id
          AND p.profile_type = 'buyer'
        )
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
        OR (
          p.company_id = requisition_item_account_assignments.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

CREATE POLICY "req_item_account_assignments: requester own"
ON public.requisition_item_account_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisition_items ri
      ON ri.id = requisition_item_account_assignments.requisition_item_id
     AND ri.company_id = requisition_item_account_assignments.company_id
    INNER JOIN public.requisitions r
      ON r.id = ri.requisition_id
     AND r.company_id = requisition_item_account_assignments.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_item_account_assignments.company_id
      AND r.requester_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.requisition_items ri
      ON ri.id = requisition_item_account_assignments.requisition_item_id
     AND ri.company_id = requisition_item_account_assignments.company_id
    INNER JOIN public.requisitions r
      ON r.id = ri.requisition_id
     AND r.company_id = requisition_item_account_assignments.company_id
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = requisition_item_account_assignments.company_id
      AND r.requester_id = auth.uid()
  )
);
