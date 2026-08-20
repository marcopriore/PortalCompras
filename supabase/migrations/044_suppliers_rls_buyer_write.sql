-- Permite compradores (admin) inserir/atualizar fornecedores do próprio tenant

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers insert suppliers in tenant" ON public.suppliers;
CREATE POLICY "Buyers insert suppliers in tenant"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = suppliers.company_id
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.role = 'admin'
        OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
      )
  )
);

DROP POLICY IF EXISTS "Buyers update suppliers in tenant" ON public.suppliers;
CREATE POLICY "Buyers update suppliers in tenant"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = suppliers.company_id
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.role = 'admin'
        OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = suppliers.company_id
      AND p.profile_type = 'buyer'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR p.role = 'admin'
        OR 'admin' = ANY(COALESCE(p.roles, ARRAY[]::text[]))
      )
  )
);
