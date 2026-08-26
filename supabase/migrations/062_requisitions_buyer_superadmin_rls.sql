-- ============================================================
-- 062 — requisitions: comprador/superadmin UPDATE + SELECT
-- Superadmin usa cookie selected_company_id no app; RLS não lê cookie.
-- Antes: policy 022 só liberava company_id do profile → update 0 linhas
-- (ex.: Master Valore em tenant POC) e o botão "Salvar e Resubmeter" parecia
-- não fazer nada.
-- ============================================================

DROP POLICY IF EXISTS "requisitions: buyer atualiza status" ON public.requisitions;

CREATE POLICY "requisitions: buyer atualiza status"
ON public.requisitions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = requisitions.company_id
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
        OR p.company_id = requisitions.company_id
      )
  )
);

DROP POLICY IF EXISTS "requisitions: buyer le tenant" ON public.requisitions;

CREATE POLICY "requisitions: buyer le tenant"
ON public.requisitions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = requisitions.company_id
      )
  )
);
