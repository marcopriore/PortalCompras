-- Vínculos do portal fornecedor: um usuário auth pode atender múltiplos tenants (compradores).

CREATE TABLE IF NOT EXISTS public.supplier_portal_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  is_supplier_admin boolean NOT NULL DEFAULT false,
  login_cnpj text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_portal_memberships_user
  ON public.supplier_portal_memberships (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_supplier_portal_memberships_tenant_supplier
  ON public.supplier_portal_memberships (company_id, supplier_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_supplier_portal_memberships_login_cnpj
  ON public.supplier_portal_memberships (login_cnpj)
  WHERE is_supplier_admin = true AND login_cnpj IS NOT NULL AND status = 'active';

-- Backfill a partir de profiles existentes (sem dados de tenant de teste — só espelha o que já existe).
INSERT INTO public.supplier_portal_memberships (
  user_id,
  company_id,
  supplier_id,
  is_supplier_admin,
  login_cnpj,
  status
)
SELECT
  p.id,
  p.company_id,
  p.supplier_id,
  coalesce(p.is_supplier_admin, false),
  p.login_cnpj,
  CASE WHEN p.status = 'active' THEN 'active' ELSE 'inactive' END
FROM public.profiles p
WHERE p.profile_type = 'supplier'
  AND p.supplier_id IS NOT NULL
  AND p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id, supplier_id) DO NOTHING;

ALTER TABLE public.supplier_portal_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier reads own portal memberships"
ON public.supplier_portal_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON TABLE public.supplier_portal_memberships IS
  'Vínculos de usuários do portal fornecedor a tenants (company_id + supplier_id).';

-- RPC: incluir memberships na resolução de login por CNPJ
CREATE OR REPLACE FUNCTION public.resolve_supplier_admin_ids_by_cnpj(p_cnpj text)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  supplier_id uuid,
  login_cnpj text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH digits AS (
    SELECT regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g') AS cnpj
  ),
  from_profiles AS (
    SELECT DISTINCT
      p.id,
      p.company_id,
      p.supplier_id,
      p.login_cnpj
    FROM profiles p
    CROSS JOIN digits d
    WHERE p.profile_type = 'supplier'
      AND coalesce(p.is_supplier_admin, false) = true
      AND p.status = 'active'
      AND length(d.cnpj) = 14
      AND (
        regexp_replace(coalesce(p.login_cnpj, ''), '\D', '', 'g') = d.cnpj
        OR EXISTS (
          SELECT 1
          FROM suppliers s
          WHERE s.id = p.supplier_id
            AND s.company_id = p.company_id
            AND (s.status IS NULL OR s.status = 'active')
            AND regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g') = d.cnpj
        )
      )
  ),
  from_memberships AS (
    SELECT DISTINCT
      m.user_id AS id,
      m.company_id,
      m.supplier_id,
      m.login_cnpj
    FROM supplier_portal_memberships m
    CROSS JOIN digits d
    WHERE m.is_supplier_admin = true
      AND m.status = 'active'
      AND length(d.cnpj) = 14
      AND (
        regexp_replace(coalesce(m.login_cnpj, ''), '\D', '', 'g') = d.cnpj
        OR EXISTS (
          SELECT 1
          FROM suppliers s
          WHERE s.id = m.supplier_id
            AND s.company_id = m.company_id
            AND (s.status IS NULL OR s.status = 'active')
            AND regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g') = d.cnpj
        )
      )
  )
  SELECT * FROM from_profiles
  UNION
  SELECT * FROM from_memberships;
$$;

COMMENT ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) IS
  'Retorna vínculos admin do portal fornecedor pelo CNPJ (profiles + memberships).';

REVOKE ALL ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) TO authenticated;
