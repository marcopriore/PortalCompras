-- Status integration_error: falha técnica/validação no Valore (ex.: código ERP duplicado no tenant).
-- Status error: pedido reprovado pelo ERP — comprador pode editar e reenviar integração.

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
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
    AND OLD.status IN ('draft', 'sent', 'error', 'integration_error')
    AND NEW.status IN ('refused', 'cancelled')
    AND OLD.contract_balance_applied = 'reserved'
  THEN
    PERFORM release_contract_balance(NEW.id);
    NEW.contract_balance_applied := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status IN ('draft', 'sent', 'error', 'integration_error')
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
