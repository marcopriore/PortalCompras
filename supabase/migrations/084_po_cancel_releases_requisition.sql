-- 084: ao cancelar PO vinculado, liberar REQ (approved / in_quotation)
-- Antes: PO cancelled → REQ cancelled (sumia da listagem e impedia Gerar Pedido).
-- Agora: se não houver outro PO ativo da mesma REQ → volta approved
--        (ou in_quotation se ainda houver quotation_id); se houver outros POs,
--        deriva o status do mais avançado entre eles.

CREATE OR REPLACE FUNCTION public.map_po_status_to_requisition_status(p_po_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_po_status
    WHEN 'draft' THEN 'awaiting_buyer'
    WHEN 'awaiting_approval' THEN 'awaiting_approval'
    WHEN 'error' THEN 'awaiting_buyer'
    WHEN 'refused' THEN 'awaiting_buyer'
    WHEN 'integration_error' THEN 'awaiting_buyer'
    WHEN 'sent' THEN 'awaiting_supplier'
    WHEN 'processing' THEN 'awaiting_supplier'
    WHEN 'completed' THEN 'completed'
    -- Cancelar o pedido libera a REQ para novo ciclo (não cancela a requisição).
    WHEN 'cancelled' THEN 'approved'
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
  v_req_origin text;
  v_req_quotation_id uuid;
  v_catalog_mode text;
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

  IF NEW.status = 'cancelled' THEN
    -- Prioriza outro PO ainda ativo da mesma requisição
    SELECT public.map_po_status_to_requisition_status(po.status)
    INTO v_req_status
    FROM public.purchase_orders po
    WHERE po.company_id = NEW.company_id
      AND po.requisition_code = NEW.requisition_code
      AND po.id IS DISTINCT FROM NEW.id
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

    IF v_req_status IS NULL THEN
      IF v_req_quotation_id IS NOT NULL THEN
        v_req_status := 'in_quotation';
      ELSE
        v_req_status := 'approved';
      END IF;
    END IF;
  ELSE
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

-- Corrige REQs que ficaram cancelled só porque o PO vinculado foi cancelado
-- (não mexe em REQs canceladas pelo solicitante sem PO, ou com quotation_id —
--  essas voltam para in_quotation quando aplicável).
UPDATE public.requisitions r
SET status = CASE
  WHEN r.quotation_id IS NOT NULL THEN 'in_quotation'
  ELSE 'approved'
END
WHERE r.status = 'cancelled'
  AND EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.company_id = r.company_id
      AND po.requisition_code = r.code
      AND po.status = 'cancelled'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.purchase_orders po2
    WHERE po2.company_id = r.company_id
      AND po2.requisition_code = r.code
      AND po2.status IS DISTINCT FROM 'cancelled'
  );
