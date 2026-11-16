-- 086: não sair de purchase_orders.awaiting_approval para o fornecedor
-- sem AR order/catalog_order aprovado.
--
-- Policy "purchase_orders: buyer gerencia tenant" (068) é FOR ALL: qualquer
-- comprador do tenant podia UPDATE status awaiting_approval → sent e o
-- fornecedor aceitava o pedido sem a alçada (catálogo CC ou pedido por valor).
-- INSERT de AR já aprovado no cliente também furava o gatilho — WITH CHECK
-- autenticado passa a exigir status = pending (decide usa service role).

DROP POLICY IF EXISTS "approval_requests: buyer tenant" ON public.approval_requests;

CREATE POLICY "approval_requests: buyer tenant"
ON public.approval_requests
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
        OR p.company_id = approval_requests.company_id
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
        OR p.company_id = approval_requests.company_id
      )
  )
  AND status = 'pending'
);

CREATE OR REPLACE FUNCTION public.enforce_po_awaiting_approval_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM 'awaiting_approval' THEN
    RETURN NEW;
  END IF;

  -- Cancelar (comprador) ou voltar a rascunho (reprovação alçada de pedido).
  IF NEW.status IN ('cancelled', 'draft') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.approval_requests ar
    WHERE ar.company_id = NEW.company_id
      AND ar.entity_id = NEW.id
      AND ar.flow IN ('order', 'catalog_order')
      AND ar.status = 'pending'
  ) THEN
    RAISE EXCEPTION
      'Pedido pendente de aprovação não pode ser enviado enquanto houver alçada pendente'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.approval_requests ar
    WHERE ar.company_id = NEW.company_id
      AND ar.entity_id = NEW.id
      AND ar.flow IN ('order', 'catalog_order')
      AND ar.status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'Pedido pendente de aprovação não pode ser enviado sem alçada aprovada'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_po_awaiting_approval_gate ON public.purchase_orders;

CREATE TRIGGER trg_enforce_po_awaiting_approval_gate
  BEFORE UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_po_awaiting_approval_gate();
