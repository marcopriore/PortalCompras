-- Resolução confiável de admin do fornecedor por CNPJ (com ou sem máscara)

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
  )
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
    );
$$;

COMMENT ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) IS
  'Retorna profiles admin do portal fornecedor cujo login_cnpj ou suppliers.cnpj bate com o CNPJ (só dígitos).';

REVOKE ALL ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_supplier_admin_ids_by_cnpj(text) TO authenticated;
