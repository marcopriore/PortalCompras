-- ============================================================
-- 069 — requisitions INSERT: superadmin cross-tenant
-- Comprador/solicitante criam com requester_id = auth.uid().
-- Policy 019 exigia company_id = profile.company_id → superadmin
-- com tenant selecionado no cookie falhava ao criar requisição.
-- Padrão alinhado à migration 062.
-- ============================================================

DROP POLICY IF EXISTS "requisitions: requester insere" ON public.requisitions;

CREATE POLICY "requisitions: requester insere"
ON public.requisitions FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.company_id = requisitions.company_id
      )
  )
);
