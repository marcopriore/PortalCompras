-- 085: SECURITY DEFINER RPCs não podem ser chamadas com a anon key
-- nem por JWT de fornecedor.
--
-- get_catalog_offers_page / facets (057/065): assert_catalog_company_access
--   permitia auth.uid() IS NULL (pensado para service_role) — a role anon
--   também tem uid nulo e herda EXECUTE de PUBLIC. company_id vaza em
--   /termos/[company_id]. Resultado: dump de preços/saldos do catálogo
--   sem login.
--
-- reserve/release/consume_contract_balance (034/037): EXECUTE padrão de
--   PUBLIC; fornecedor autenticado (que vê o UUID do pedido) podia
--   reservar/liberar/consumir saldo sem mudar o status do PO.

CREATE OR REPLACE FUNCTION public.assert_catalog_company_access(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- API Next (service_role) já fez authz; JWT service_role não tem uid.
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden catalog access';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.status, 'active') = 'active'
      AND (
        COALESCE(p.is_superadmin, false) = true
        OR (
          p.company_id = p_company_id
          AND p.profile_type IN ('buyer', 'requester')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Forbidden catalog access';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_catalog_company_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_catalog_company_access(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_catalog_offers_page(uuid, text, text[], uuid[], integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_offers_page(uuid, text, text[], uuid[], integer, integer, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_catalog_offer_facets(uuid, text, text[], uuid[], text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalog_offer_facets(uuid, text, text[], uuid[], text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.po_has_contract_items(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.po_has_contract_items(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_contract_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_contract_balance(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_contract_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_contract_balance(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consume_contract_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contract_balance(uuid) TO service_role;
