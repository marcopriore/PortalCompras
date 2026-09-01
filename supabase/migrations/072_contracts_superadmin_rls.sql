-- ============================================================
-- 072 — contracts / contract_items: superadmin cross-tenant
-- Superadmin opera tenant via cookie selected_company_id no app;
-- RLS não lê cookie → INSERT falhava com violação de policy.
-- Padrão alinhado às migrations 062 e 068.
-- ============================================================

-- contracts
DROP POLICY IF EXISTS "contracts: leitura por tenant" ON public.contracts;
DROP POLICY IF EXISTS "contracts: escrita por buyer" ON public.contracts;
DROP POLICY IF EXISTS "contracts: update por buyer" ON public.contracts;
DROP POLICY IF EXISTS "contracts: delete por buyer" ON public.contracts;
DROP POLICY IF EXISTS "contracts: buyer gerencia tenant" ON public.contracts;

CREATE POLICY "contracts: buyer gerencia tenant"
ON public.contracts
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
        OR p.company_id = contracts.company_id
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
        OR p.company_id = contracts.company_id
      )
  )
);

-- contract_items
DROP POLICY IF EXISTS "contract_items: leitura por tenant" ON public.contract_items;
DROP POLICY IF EXISTS "contract_items: escrita por buyer" ON public.contract_items;
DROP POLICY IF EXISTS "contract_items: update por buyer" ON public.contract_items;
DROP POLICY IF EXISTS "contract_items: delete por buyer" ON public.contract_items;
DROP POLICY IF EXISTS "contract_items: buyer gerencia tenant" ON public.contract_items;

CREATE POLICY "contract_items: buyer gerencia tenant"
ON public.contract_items
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
        OR p.company_id = contract_items.company_id
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
        OR p.company_id = contract_items.company_id
      )
  )
);
