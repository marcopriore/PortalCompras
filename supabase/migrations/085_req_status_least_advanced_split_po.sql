-- 085: REQ com vários POs (split por site_code) segue o PO ativo menos avançado.
-- 084 só agregava irmãos no cancelamento e usava o mais avançado; completar o
-- PO da MATRIZ marcava a REQ completed enquanto a FILIAL ainda estava draft.
-- Catálogo sem PO ativo volta a cancelled (não approved) para não reabrir
-- Gerar Pedido/Cotação fora do contrato.

CREATE OR REPLACE FUNCTION public.po_status_open_progress_rank(p_po_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_po_status
    WHEN 'draft' THEN 1
    WHEN 'error' THEN 1
    WHEN 'refused' THEN 1
    WHEN 'integration_error' THEN 1
    WHEN 'awaiting_approval' THEN 2
    WHEN 'sent' THEN 3
    WHEN 'processing' THEN 3
    WHEN 'completed' THEN 4
    ELSE 9
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
  v_least_po_status text;
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

  -- AFTER INSERT/UPDATE: NEW já está na tabela; cancelled fica de fora.
  SELECT po.status
  INTO v_least_po_status
  FROM public.purchase_orders po
  WHERE po.company_id = NEW.company_id
    AND po.requisition_code = NEW.requisition_code
    AND po.status IS DISTINCT FROM 'cancelled'
  ORDER BY
    public.po_status_open_progress_rank(po.status),
    po.created_at ASC
  LIMIT 1;

  IF v_least_po_status IS NULL THEN
    IF v_req_origin = 'catalog' THEN
      v_req_status := 'cancelled';
    ELSIF v_req_quotation_id IS NOT NULL THEN
      v_req_status := 'in_quotation';
    ELSE
      v_req_status := 'approved';
    END IF;
  ELSE
    v_req_status := public.map_po_status_to_requisition_status(v_least_po_status);

    IF v_req_origin = 'catalog' AND v_least_po_status = 'draft' THEN
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

-- Repara REQs já marcadas completed/awaiting_* enquanto um irmão ainda está aberto.
WITH least_open AS (
  SELECT DISTINCT ON (po.company_id, po.requisition_code)
    po.company_id,
    po.requisition_code,
    public.map_po_status_to_requisition_status(po.status) AS req_status
  FROM public.purchase_orders po
  WHERE po.requisition_code IS NOT NULL
    AND trim(po.requisition_code) <> ''
    AND po.status IS DISTINCT FROM 'cancelled'
  ORDER BY
    po.company_id,
    po.requisition_code,
    public.po_status_open_progress_rank(po.status),
    po.created_at ASC
)
UPDATE public.requisitions r
SET status = least_open.req_status
FROM least_open
WHERE r.company_id = least_open.company_id
  AND r.code = least_open.requisition_code
  AND least_open.req_status IS NOT NULL
  AND r.status IS DISTINCT FROM least_open.req_status
  AND r.status NOT IN ('rejected');
