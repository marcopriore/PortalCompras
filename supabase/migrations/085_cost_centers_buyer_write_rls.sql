-- ============================================================
-- 085 — cost_centers: escrita só comprador; leitura requester
--
-- 061 liberava FOR ALL para qualquer profile com o mesmo company_id.
-- Fornecedor (e requisitante) compartilham company_id do tenant comprador:
-- JWT autenticado podia INSERT/UPDATE/DELETE o cadastro de centros de custo.
--
-- Impacto: esvaziar o picklist (REQ/catálogo), trocar códigos e desviar
-- matching de alçada (get_approver_for_requisition / catalog_order).
--
-- Escrita: profile_type = buyer (+ superadmin).
-- Leitura: requester no próprio tenant (CostCenterSelect no portal).
-- ============================================================

DROP POLICY IF EXISTS "company_manage_cost_centers" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers: requester le tenant" ON public.cost_centers;

CREATE POLICY "company_manage_cost_centers"
ON public.cost_centers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = cost_centers.company_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = cost_centers.company_id
      )
  )
);

CREATE POLICY "cost_centers: requester le tenant"
ON public.cost_centers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = cost_centers.company_id
  )
);
