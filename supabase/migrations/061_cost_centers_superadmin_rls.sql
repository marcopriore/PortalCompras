-- ============================================================
-- 061 — cost_centers: superadmin pode gerenciar qualquer tenant
-- (cookie selected_company_id no app; RLS não lê cookie — libera is_superadmin)
-- ============================================================

DROP POLICY IF EXISTS "company_manage_cost_centers" ON public.cost_centers;

CREATE POLICY "company_manage_cost_centers"
ON public.cost_centers FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = cost_centers.company_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = cost_centers.company_id
      )
  )
);
