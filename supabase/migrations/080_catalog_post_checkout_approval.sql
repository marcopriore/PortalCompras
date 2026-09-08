-- 080: Catálogo — modo pós-checkout + fluxo catalog_order + status awaiting_approval
-- awaiting_approval = Pendente Aprovação (pedido de catálogo, gestor CC)

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
      'awaiting_approval',
      'awaiting_supplier',
      'completed',
      'cancelled'
    )
  );

-- flow catalog_order em approval_requests (idempotente; ver também 081 se 080 já aplicada)
ALTER TABLE public.approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_flow_check;

ALTER TABLE public.approval_requests
  ADD CONSTRAINT approval_requests_flow_check
  CHECK (flow IN ('requisition', 'order', 'catalog_order'));

-- Sync REQ←PO: catálogo em modo cost_center_approval + PO draft → awaiting_approval
CREATE OR REPLACE FUNCTION public.sync_requisition_status_from_purchase_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_status text;
  v_req_origin text;
  v_catalog_mode text;
BEGIN
  IF NEW.requisition_code IS NULL OR trim(NEW.requisition_code) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT r.origin INTO v_req_origin
  FROM public.requisitions r
  WHERE r.company_id = NEW.company_id
    AND r.code = NEW.requisition_code
  LIMIT 1;

  v_req_status := public.map_po_status_to_requisition_status(NEW.status);

  IF v_req_origin = 'catalog' AND NEW.status = 'draft' THEN
    SELECT trim(lower(cs.value)) INTO v_catalog_mode
    FROM public.company_settings cs
    WHERE cs.company_id = NEW.company_id
      AND cs.key = 'catalog_post_checkout_mode'
    LIMIT 1;

    IF v_catalog_mode = 'cost_center_approval' THEN
      v_req_status := 'awaiting_approval';
    END IF;
  END IF;

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

-- Aprovador por CC para fluxo Pedido — Catálogo (espelha REQ)
CREATE OR REPLACE FUNCTION public.get_approver_for_catalog_order(
  p_company_id uuid,
  p_cost_center text DEFAULT '*'
)
RETURNS TABLE (approver_id uuid, approver_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT al.approver_id, al.approver_name
  FROM public.approval_levels al
  WHERE al.company_id = p_company_id
    AND al.flow = 'catalog_order'
    AND al.approver_id IS NOT NULL
    AND (
      al.cost_center = p_cost_center
      OR al.cost_center = '*'
      OR al.cost_center IS NULL
    )
  ORDER BY
    CASE
      WHEN al.cost_center = p_cost_center THEN 0
      WHEN al.cost_center = '*' OR al.cost_center IS NULL THEN 1
      ELSE 2
    END,
    al.created_at ASC NULLS LAST
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_approver_for_catalog_order(uuid, text)
  TO authenticated, service_role;
