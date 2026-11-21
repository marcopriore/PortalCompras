-- 085: sync da REQ usa o PO mais avançado da mesma requisition_code
-- 084 já agregava irmãos só no cancelamento. Nos demais UPDATE/INSERT o trigger
-- copiava só NEW.status, então um PO menos avançado rebaixava a REQ
-- (ex.: PO-A completed + PO-B processing → awaiting_supplier).
-- Catálogo/equalização criam 1 REQ e N POs no split por site_code.

CREATE OR REPLACE FUNCTION public.sync_requisition_status_from_purchase_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_status text;
  v_req_origin text;
  v_req_quotation_id uuid;
  v_catalog_mode text;
  v_winning_po_status text;
BEGIN
  IF NEW.requisition_code IS NULL OR trim(NEW.requisition_code) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT r.origin, r.quotation_id
  INTO v_req_origin, v_req_quotation_id
  FROM public.requisitions r
  WHERE r.company_id = NEW.company_id
    AND r.code = NEW.requisition_code
  LIMIT 1;

  -- Sempre o PO ativo mais avançado (inclui NEW: trigger é AFTER INSERT/UPDATE).
  SELECT po.status
  INTO v_winning_po_status
  FROM public.purchase_orders po
  WHERE po.company_id = NEW.company_id
    AND po.requisition_code = NEW.requisition_code
    AND po.status IS DISTINCT FROM 'cancelled'
  ORDER BY
    CASE po.status
      WHEN 'completed' THEN 1
      WHEN 'processing' THEN 2
      WHEN 'sent' THEN 3
      WHEN 'awaiting_approval' THEN 4
      WHEN 'draft' THEN 5
      WHEN 'error' THEN 6
      WHEN 'refused' THEN 6
      WHEN 'integration_error' THEN 6
      ELSE 9
    END,
    po.created_at DESC
  LIMIT 1;

  IF v_winning_po_status IS NULL THEN
    -- Só cancela/libera ciclo quando não resta PO ativo (comportamento 084).
    IF NEW.status = 'cancelled' THEN
      IF v_req_quotation_id IS NOT NULL THEN
        v_req_status := 'in_quotation';
      ELSE
        v_req_status := 'approved';
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    v_req_status := public.map_po_status_to_requisition_status(v_winning_po_status);
    IF v_req_status IS NULL THEN
      RETURN NEW;
    END IF;

    IF v_req_origin = 'catalog' AND v_winning_po_status = 'draft' THEN
      SELECT trim(lower(cs.value)) INTO v_catalog_mode
      FROM public.company_settings cs
      WHERE cs.company_id = NEW.company_id
        AND cs.key = 'catalog_post_checkout_mode'
      LIMIT 1;

      IF v_catalog_mode = 'cost_center_approval' THEN
        v_req_status := 'awaiting_approval';
      END IF;
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
