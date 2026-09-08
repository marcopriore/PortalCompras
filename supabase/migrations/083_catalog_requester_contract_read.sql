-- ============================================================
-- 083 — Catálogo: leitura de contratos para requisitante
--
-- Listagem de ofertas usa get_catalog_offers_page (SECURITY DEFINER).
-- Validação do carrinho (resolveCartOfferLine) consulta contract_items
-- com o client autenticado; RLS 072 só permite profile_type = buyer →
-- requisitante via null e a API respondia "Oferta indisponível ou sem saldo".
--
-- Leitura SELECT no próprio tenant (sem escrita). Escrita continua buyer-only.
-- ============================================================

DROP POLICY IF EXISTS "contracts: requester le tenant" ON public.contracts;
CREATE POLICY "contracts: requester le tenant"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = contracts.company_id
  )
);

DROP POLICY IF EXISTS "contract_items: requester le tenant" ON public.contract_items;
CREATE POLICY "contract_items: requester le tenant"
ON public.contract_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = contract_items.company_id
  )
);

-- Leitura de fornecedores no checkout do catálogo (nome/CNPJ no pedido)
DROP POLICY IF EXISTS "suppliers: requester le tenant" ON public.suppliers;
CREATE POLICY "suppliers: requester le tenant"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'requester'
      AND p.company_id = suppliers.company_id
  )
);
