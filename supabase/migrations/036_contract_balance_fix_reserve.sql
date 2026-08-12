-- Migration 036: corrigir reserve_contract_balance após remoção de contract_id do cabeçalho
-- Erro: record "v_po" has no field "contract_id"
-- Causa: 034 antiga usava purchase_orders.contract_id; 035 removeu a coluna mas não atualizou a função.

CREATE OR REPLACE FUNCTION reserve_contract_balance(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract contracts%ROWTYPE;
  v_po_item record;
  v_total_po numeric(15,2) := 0;
  v_line_value numeric(15,2);
  v_available_qty numeric(15,3);
  v_available_value numeric(15,2);
  v_ceiling numeric(15,2);
  v_contract_id uuid;
BEGIN
  IF NOT po_has_contract_items(p_order_id) THEN
    RETURN;
  END IF;

  SELECT DISTINCT poi.contract_id INTO v_contract_id
  FROM purchase_order_items poi
  WHERE poi.purchase_order_id = p_order_id
    AND poi.contract_item_id IS NOT NULL
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Linha do pedido sem contrato vinculado';
  END IF;

  IF (
    SELECT COUNT(DISTINCT poi.contract_id)
    FROM purchase_order_items poi
    WHERE poi.purchase_order_id = p_order_id
      AND poi.contract_item_id IS NOT NULL
  ) > 1 THEN
    RAISE EXCEPTION 'Pedido com mais de um contrato nas linhas não é suportado na v1';
  END IF;

  SELECT * INTO v_contract FROM contracts WHERE id = v_contract_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  IF v_contract.status <> 'active' THEN
    RAISE EXCEPTION 'Contrato não está ativo';
  END IF;

  IF v_contract.end_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Contrato expirado';
  END IF;

  IF v_contract.start_date IS NOT NULL AND v_contract.start_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Contrato ainda não está em vigência';
  END IF;

  SELECT COALESCE(SUM(ROUND(poi.quantity * poi.unit_price, 2)), 0)
  INTO v_total_po
  FROM purchase_order_items poi
  WHERE poi.purchase_order_id = p_order_id
    AND poi.contract_item_id IS NOT NULL;

  IF v_total_po <= 0 THEN
    RAISE EXCEPTION 'Pedido sem itens vinculados ao contrato';
  END IF;

  IF v_contract.contract_kind = 'por_quantidade' THEN
    FOR v_po_item IN
      SELECT
        poi.quantity,
        poi.material_code,
        ci.quantity_contracted,
        ci.quantity_consumed,
        ci.reserved_quantity
      FROM purchase_order_items poi
      INNER JOIN contract_items ci ON ci.id = poi.contract_item_id
      WHERE poi.purchase_order_id = p_order_id
        AND poi.contract_item_id IS NOT NULL
        AND ci.eliminated = false
    LOOP
      v_available_qty :=
        v_po_item.quantity_contracted
        - v_po_item.quantity_consumed
        - v_po_item.reserved_quantity;
      IF v_po_item.quantity > v_available_qty THEN
        RAISE EXCEPTION 'Saldo insuficiente para o item %', v_po_item.material_code;
      END IF;
    END LOOP;
  END IF;

  IF v_contract.contract_kind = 'por_valor' THEN
    v_ceiling := COALESCE(v_contract.value, v_contract.total_value, 0);
    v_available_value :=
      v_ceiling - v_contract.consumed_value - v_contract.reserved_value;
    IF v_total_po > v_available_value THEN
      RAISE EXCEPTION 'Saldo do contrato insuficiente (disponível: %)', v_available_value;
    END IF;
  END IF;

  FOR v_po_item IN
    SELECT poi.quantity, poi.contract_item_id, ci.unit_price
    FROM purchase_order_items poi
    INNER JOIN contract_items ci ON ci.id = poi.contract_item_id
    WHERE poi.purchase_order_id = p_order_id
      AND poi.contract_item_id IS NOT NULL
      AND ci.eliminated = false
  LOOP
    v_line_value := ROUND(v_po_item.quantity * v_po_item.unit_price, 2);
    UPDATE contract_items SET
      reserved_quantity = reserved_quantity + v_po_item.quantity,
      reserved_value = reserved_value + v_line_value
    WHERE id = v_po_item.contract_item_id;
  END LOOP;
END;
$$;
