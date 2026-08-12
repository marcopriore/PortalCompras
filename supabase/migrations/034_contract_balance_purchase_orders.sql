-- Migration 034: consumo de saldo de contratos via pedidos de compra
-- Referência de contrato por LINHA do pedido (estilo ME23N)
-- Reserva: draft / sent / error | Consumo: processing (aceite) ou completed

-- 1. Colunas de reserva
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS reserved_value    numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric(15,3) NOT NULL DEFAULT 0;

ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS reserved_value    numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric(15,3) NOT NULL DEFAULT 0;

-- 2. Vínculo contrato por linha do pedido
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS contract_item_id uuid REFERENCES contract_items(id) ON DELETE RESTRICT;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS contract_balance_applied text
    CHECK (contract_balance_applied IS NULL OR contract_balance_applied IN ('reserved', 'consumed'));

CREATE INDEX IF NOT EXISTS idx_poi_contract_id
  ON purchase_order_items(contract_id) WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_poi_contract_item_id
  ON purchase_order_items(contract_item_id) WHERE contract_item_id IS NOT NULL;

-- 3. Recalcular totais do contrato (inclui reservas)
CREATE OR REPLACE FUNCTION update_contract_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contracts SET
    consumed_value = (
      SELECT COALESCE(SUM(consumed_value), 0)
      FROM contract_items
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
        AND eliminated = false
    ),
    consumed_quantity = (
      SELECT COALESCE(SUM(quantity_consumed), 0)
      FROM contract_items
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
        AND eliminated = false
    ),
    reserved_value = (
      SELECT COALESCE(SUM(reserved_value), 0)
      FROM contract_items
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
        AND eliminated = false
    ),
    reserved_quantity = (
      SELECT COALESCE(SUM(reserved_quantity), 0)
      FROM contract_items
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
        AND eliminated = false
    ),
    total_value = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM contract_items
      WHERE contract_id = COALESCE(NEW.contract_id, OLD.contract_id)
        AND eliminated = false
    )
  WHERE id = COALESCE(NEW.contract_id, OLD.contract_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Pedido possui linhas vinculadas a contrato?
CREATE OR REPLACE FUNCTION po_has_contract_items(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM purchase_order_items
    WHERE purchase_order_id = p_order_id
      AND contract_item_id IS NOT NULL
  );
$$;

-- 5. Reservar saldo
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

-- 6. Liberar reserva
CREATE OR REPLACE FUNCTION release_contract_balance(p_order_id uuid)
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
      reserved_quantity = GREATEST(0, reserved_quantity - v_po_item.quantity),
      reserved_value = GREATEST(0, reserved_value - v_line_value)
    WHERE id = v_po_item.contract_item_id;
  END LOOP;
END;
$$;

-- 7. Consumir saldo (reserva → consumo efetivo)
CREATE OR REPLACE FUNCTION consume_contract_balance(p_order_id uuid)
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
      reserved_quantity = GREATEST(0, reserved_quantity - v_po_item.quantity),
      reserved_value = GREATEST(0, reserved_value - v_line_value),
      quantity_consumed = quantity_consumed + v_po_item.quantity,
      consumed_value = consumed_value + v_line_value
    WHERE id = v_po_item.contract_item_id;
  END LOOP;
END;
$$;

-- 8. Trigger: transições de status do pedido
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

  -- Liberar reserva ao recusar ou cancelar (antes do consumo)
  IF TG_OP = 'UPDATE'
    AND OLD.status IN ('draft', 'sent', 'error')
    AND NEW.status IN ('refused', 'cancelled')
    AND OLD.contract_balance_applied = 'reserved'
  THEN
    PERFORM release_contract_balance(NEW.id);
    NEW.contract_balance_applied := NULL;
  END IF;

  -- Consumir ao aceitar (processing) ou concluir (completed)
  IF TG_OP = 'UPDATE'
    AND OLD.status IN ('draft', 'sent', 'error')
    AND NEW.status IN ('processing', 'completed')
    AND OLD.contract_balance_applied = 'reserved'
  THEN
    PERFORM consume_contract_balance(NEW.id);
    NEW.contract_balance_applied := 'consumed';
  END IF;

  -- Re-reservar ao reenviar pedido recusado
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

DROP TRIGGER IF EXISTS trg_po_contract_balance ON purchase_orders;
CREATE TRIGGER trg_po_contract_balance
  BEFORE UPDATE OF status ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_po_contract_balance_on_status_change();
