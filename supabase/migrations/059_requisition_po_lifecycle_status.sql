-- Migration 059: status de requisição alinhados ao ciclo do pedido
-- awaiting_buyer = Pendente Comprador (PO draft/error/refused/…)
-- awaiting_supplier = Pendente Aceite Fornecedor (PO sent/processing)

ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;
ALTER TABLE public.requisitions ADD CONSTRAINT requisitions_status_check
  CHECK (
    status IN (
      'draft',
      'buyer_review',
      'pending',
      'approved',
      'rejected',
      'in_quotation',
      'awaiting_buyer',
      'awaiting_supplier',
      'completed',
      'cancelled'
    )
  );

-- Mapeia status do pedido → status da requisição vinculada
CREATE OR REPLACE FUNCTION public.map_po_status_to_requisition_status(p_po_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_po_status
    WHEN 'draft' THEN 'awaiting_buyer'
    WHEN 'error' THEN 'awaiting_buyer'
    WHEN 'refused' THEN 'awaiting_buyer'
    WHEN 'integration_error' THEN 'awaiting_buyer'
    WHEN 'sent' THEN 'awaiting_supplier'
    WHEN 'processing' THEN 'awaiting_supplier'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_requisition_status_from_purchase_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_status text;
BEGIN
  IF NEW.requisition_code IS NULL OR trim(NEW.requisition_code) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_req_status := map_po_status_to_requisition_status(NEW.status);
  IF v_req_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.requisitions
  SET status = v_req_status
  WHERE company_id = NEW.company_id
    AND code = NEW.requisition_code
    AND status IS DISTINCT FROM v_req_status
    AND status NOT IN ('rejected');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_requisition_from_po ON public.purchase_orders;
CREATE TRIGGER trg_sync_requisition_from_po
  AFTER INSERT OR UPDATE OF status, requisition_code
  ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_requisition_status_from_purchase_order();

-- Backfill: REQ de catálogo já "completed" com PO ainda aberto
UPDATE public.requisitions r
SET status = public.map_po_status_to_requisition_status(po.status)
FROM public.purchase_orders po
WHERE po.company_id = r.company_id
  AND po.requisition_code = r.code
  AND r.origin = 'catalog'
  AND r.status = 'completed'
  AND po.status IS DISTINCT FROM 'completed'
  AND public.map_po_status_to_requisition_status(po.status) IS NOT NULL;

GRANT EXECUTE ON FUNCTION public.map_po_status_to_requisition_status(text) TO authenticated, service_role;
