-- 082: purchase_orders.status awaiting_approval (Pedido — Catálogo pendente gestor CC)

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'awaiting_approval'::text,
        'processing'::text,
        'sent'::text,
        'refused'::text,
        'error'::text,
        'integration_error'::text,
        'completed'::text,
        'cancelled'::text
      ]
    )
  );

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
    WHEN 'cancelled' THEN 'cancelled'
    ELSE NULL
  END;
$$;

-- Sync: awaiting_approval já mapeia via função; mantém override legado draft+catálogo+modo
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

-- Saldo contrato: awaiting_approval comporta-se como draft (reserva ativa)
CREATE OR REPLACE FUNCTION trg_po_contract_balance_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT po_has_contract_items(NEW.id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status IN ('draft', 'awaiting_approval', 'sent', 'error', 'integration_error')
    AND NEW.status IN ('refused', 'cancelled')
    AND OLD.contract_balance_applied = 'reserved'
  THEN
    PERFORM release_contract_balance(NEW.id);
    NEW.contract_balance_applied := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status IN ('draft', 'awaiting_approval', 'sent', 'error', 'integration_error')
    AND NEW.status IN ('processing', 'completed')
    AND OLD.contract_balance_applied = 'reserved'
  THEN
    PERFORM consume_contract_balance(NEW.id);
    NEW.contract_balance_applied := 'consumed';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status = 'refused'
    AND NEW.status = 'sent'
    AND NEW.contract_balance_applied IS NULL
  THEN
    PERFORM reserve_contract_balance(NEW.id);
    NEW.contract_balance_applied := 'reserved';
  END IF;

  RETURN NEW;
END;
$$;
