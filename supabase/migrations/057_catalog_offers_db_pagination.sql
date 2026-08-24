-- Migration 057: paginação de ofertas do catálogo no banco (evita scan completo em memória)

CREATE OR REPLACE FUNCTION public.assert_catalog_company_access(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.company_id = p_company_id OR COALESCE(p.is_superadmin, false))
  ) THEN
    RAISE EXCEPTION 'Forbidden catalog access';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_catalog_offers_page(
  p_company_id uuid,
  p_search text DEFAULT NULL,
  p_commodity_groups text[] DEFAULT NULL,
  p_supplier_ids uuid[] DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 18
)
RETURNS TABLE (
  contract_item_id uuid,
  contract_id uuid,
  contract_code text,
  contract_title text,
  contract_kind text,
  supplier_id uuid,
  supplier_name text,
  supplier_code text,
  material_code text,
  material_description text,
  long_description text,
  unit_of_measure text,
  commodity_group text,
  unit_price numeric,
  delivery_days integer,
  available_quantity numeric,
  available_value numeric,
  contract_end_date date,
  payment_condition_code text,
  payment_condition_description text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text;
  v_offset integer;
  v_limit integer;
BEGIN
  PERFORM assert_catalog_company_access(p_company_id);

  v_search := NULLIF(lower(trim(COALESCE(p_search, ''))), '');
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 18), 1), 50);

  RETURN QUERY
  WITH eligible AS (
    SELECT
      ci.id AS contract_item_id,
      ci.contract_id,
      c.code AS contract_code,
      c.title AS contract_title,
      c.contract_kind,
      c.supplier_id,
      c.end_date AS contract_end_date,
      ci.material_code,
      ci.material_description,
      ci.unit_of_measure,
      ci.unit_price,
      ci.delivery_days,
      s.name AS supplier_name,
      s.code AS supplier_code,
      pc.code AS payment_condition_code,
      pc.description AS payment_condition_description,
      i.long_description,
      i.commodity_group,
      CASE
        WHEN c.contract_kind = 'por_quantidade' THEN
          GREATEST(0, ci.quantity_contracted - ci.quantity_consumed - ci.reserved_quantity)
        ELSE NULL
      END AS available_quantity,
      GREATEST(0, ci.total_price - ci.consumed_value - ci.reserved_value) AS available_value
    FROM contract_items ci
    INNER JOIN contracts c ON c.id = ci.contract_id
    INNER JOIN items i
      ON i.company_id = ci.company_id
     AND i.code = ci.material_code
    INNER JOIN suppliers s ON s.id = c.supplier_id
    LEFT JOIN payment_conditions pc ON pc.id = c.payment_condition_id
    WHERE ci.company_id = p_company_id
      AND c.company_id = p_company_id
      AND i.company_id = p_company_id
      AND c.status = 'active'
      AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND ci.eliminated = false
      AND trim(ci.material_code) <> ''
      AND i.status = 'active'
      AND (
        (
          c.contract_kind = 'por_quantidade'
          AND (ci.quantity_contracted - ci.quantity_consumed - ci.reserved_quantity) > 0
        )
        OR (
          c.contract_kind = 'por_valor'
          AND (ci.total_price - ci.consumed_value - ci.reserved_value) > 0
        )
      )
      AND (
        p_supplier_ids IS NULL
        OR cardinality(p_supplier_ids) = 0
        OR c.supplier_id = ANY (p_supplier_ids)
      )
      AND (
        p_commodity_groups IS NULL
        OR cardinality(p_commodity_groups) = 0
        OR i.commodity_group = ANY (p_commodity_groups)
      )
      AND (
        v_search IS NULL
        OR lower(ci.material_code) LIKE '%' || v_search || '%'
        OR lower(ci.material_description) LIKE '%' || v_search || '%'
        OR lower(COALESCE(i.long_description, '')) LIKE '%' || v_search || '%'
        OR lower(c.code) LIKE '%' || v_search || '%'
        OR lower(c.title) LIKE '%' || v_search || '%'
        OR lower(s.name) LIKE '%' || v_search || '%'
      )
  )
  SELECT
    e.contract_item_id,
    e.contract_id,
    e.contract_code,
    e.contract_title,
    e.contract_kind,
    e.supplier_id,
    e.supplier_name,
    e.supplier_code,
    e.material_code,
    e.material_description,
    e.long_description,
    e.unit_of_measure,
    e.commodity_group,
    e.unit_price,
    e.delivery_days,
    e.available_quantity,
    e.available_value,
    e.contract_end_date,
    e.payment_condition_code,
    e.payment_condition_description,
    COUNT(*) OVER() AS total_count
  FROM eligible e
  ORDER BY e.material_description ASC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_catalog_offer_facets(
  p_company_id uuid,
  p_search text DEFAULT NULL,
  p_commodity_groups text[] DEFAULT NULL,
  p_supplier_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text;
  v_result jsonb;
BEGIN
  PERFORM assert_catalog_company_access(p_company_id);

  v_search := NULLIF(lower(trim(COALESCE(p_search, ''))), '');

  WITH eligible AS (
    SELECT
      c.supplier_id,
      s.name AS supplier_name,
      s.code AS supplier_code,
      i.commodity_group
    FROM contract_items ci
    INNER JOIN contracts c ON c.id = ci.contract_id
    INNER JOIN items i
      ON i.company_id = ci.company_id
     AND i.code = ci.material_code
    INNER JOIN suppliers s ON s.id = c.supplier_id
    WHERE ci.company_id = p_company_id
      AND c.company_id = p_company_id
      AND i.company_id = p_company_id
      AND c.status = 'active'
      AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND ci.eliminated = false
      AND trim(ci.material_code) <> ''
      AND i.status = 'active'
      AND (
        (
          c.contract_kind = 'por_quantidade'
          AND (ci.quantity_contracted - ci.quantity_consumed - ci.reserved_quantity) > 0
        )
        OR (
          c.contract_kind = 'por_valor'
          AND (ci.total_price - ci.consumed_value - ci.reserved_value) > 0
        )
      )
      AND (
        p_supplier_ids IS NULL
        OR cardinality(p_supplier_ids) = 0
        OR c.supplier_id = ANY (p_supplier_ids)
      )
      AND (
        p_commodity_groups IS NULL
        OR cardinality(p_commodity_groups) = 0
        OR i.commodity_group = ANY (p_commodity_groups)
      )
      AND (
        v_search IS NULL
        OR lower(ci.material_code) LIKE '%' || v_search || '%'
        OR lower(ci.material_description) LIKE '%' || v_search || '%'
        OR lower(COALESCE(i.long_description, '')) LIKE '%' || v_search || '%'
        OR lower(c.code) LIKE '%' || v_search || '%'
        OR lower(c.title) LIKE '%' || v_search || '%'
        OR lower(s.name) LIKE '%' || v_search || '%'
      )
  ),
  groups AS (
    SELECT DISTINCT trim(commodity_group) AS grp
    FROM eligible
    WHERE commodity_group IS NOT NULL
      AND trim(commodity_group) <> ''
  ),
  supplier_rows AS (
    SELECT DISTINCT supplier_id, supplier_name, supplier_code
    FROM eligible
  )
  SELECT jsonb_build_object(
    'commodity_groups',
    COALESCE(
      (SELECT jsonb_agg(grp ORDER BY grp) FROM groups),
      '[]'::jsonb
    ),
    'suppliers',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', supplier_id,
            'name', supplier_name,
            'code', supplier_code
          )
          ORDER BY supplier_name
        )
        FROM supplier_rows
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_contracts_catalog_active
  ON contracts (company_id, status, start_date, end_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_contract_items_catalog
  ON contract_items (company_id, material_code)
  WHERE eliminated = false;

GRANT EXECUTE ON FUNCTION public.assert_catalog_company_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_offers_page(uuid, text, text[], uuid[], integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_offer_facets(uuid, text, text[], uuid[]) TO authenticated, service_role;
