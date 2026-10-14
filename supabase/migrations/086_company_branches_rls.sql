-- ============================================================
-- 086 — company_branches: fornecedor não altera endereço de entrega
--
-- 078 criou policy "company_manage_branches" FOR ALL sem filtrar
-- profile_type. Sessão do portal fornecedor (mesmo company_id do
-- comprador) podia UPDATE/DELETE filiais — desviar o endereço copiado
-- para o cabeçalho do pedido no Gerar Pedido / checkout / equalização.
--
-- Leitura: buyer e requester do tenant (+ superadmin).
-- Escrita: só buyer do tenant (+ superadmin). Service role inalterado.
-- ============================================================

DROP POLICY IF EXISTS "company_manage_branches" ON public.company_branches;
DROP POLICY IF EXISTS "company_branches: tenant read" ON public.company_branches;
DROP POLICY IF EXISTS "company_branches: buyer write" ON public.company_branches;

CREATE POLICY "company_branches: tenant read"
ON public.company_branches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = company_branches.company_id
          AND p.profile_type IN ('buyer', 'requester')
        )
      )
  )
);

CREATE POLICY "company_branches: buyer write"
ON public.company_branches
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = company_branches.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

CREATE POLICY "company_branches: buyer update"
ON public.company_branches
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = company_branches.company_id
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
          p.company_id = company_branches.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);

CREATE POLICY "company_branches: buyer delete"
ON public.company_branches
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = company_branches.company_id
          AND p.profile_type = 'buyer'
        )
      )
  )
);
