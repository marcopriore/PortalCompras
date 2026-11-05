-- 085: devolver saldo consumido ao cancelar/recusar pedido já aceito ou integrado.
--
-- Até 082 o trigger só chamava release_contract_balance quando
-- contract_balance_applied = 'reserved'. Aceite (processing) / ERP (completed)
-- já tinham consumido; Cancelar Pedido (UI de pedido integrado) e recusa
-- deixavam quantity_consumed / consumed_value no contrato. A REQ volta a
-- approved (084) e um novo PO reserva+consome de novo no mesmo item.
--
-- Manter o grafo de transições alinhado a lib/contracts/po-contract-balance-transition.ts

CREATE OR REPLACE FUNCTION public.unconsume_contract_balance(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_item record;
  v_line_value numeric(15,2);
BEGIN
  FOR v_po_item IN
    SELECT poi.quantity, poi.contract_item_id, ci.unit_price
    FROM purchase_order_items poi
    INNER JOIN contract_items ci ON ci.id = poi.contract_item_id
    WHERE poi.purchase_order_id = p_order_id
      AND poi.contract_item_id IS NOT NULL
  LOOP
    v_line_value := ROUND(v_po_item.quantity * v_po_item.unit_price, 2);
    UPDATE contract_items SET
      quantity_consumed = GREATEST(0, quantity_consumed - v_po_item.quantity),
      consumed_value = GREATEST(0, consumed_value - v_line_value)
    WHERE id = v_po_item.contract_item_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.unconsume_contract_balance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unconsume_contract_balance(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_po_contract_balance_on_status_change()
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

  IF TG_OP = 'UPDATE'
    AND NEW.status IN ('refused', 'cancelled')
    AND OLD.contract_balance_applied = 'consumed'
  THEN
    PERFORM unconsume_contract_balance(NEW.id);
    NEW.contract_balance_applied := NULL;
  END IF;

  RETURN NEW;
END;
$$;
