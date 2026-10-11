-- 085: fornecedor não pode alterar identidade/comercial do pedido via RLS
-- A policy "Supplier updates own purchase_orders" (010) era FOR UPDATE sem
-- restrição de coluna: um session de fornecedor podia mudar company_id,
-- total_price ou status (ex.: draft → processing) e sumir/forçar o pedido.

DROP POLICY IF EXISTS "Supplier updates own purchase_orders" ON public.purchase_orders;

CREATE POLICY "Supplier updates own purchase_orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = purchase_orders.supplier_id
      AND p.company_id = purchase_orders.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
      AND p.supplier_id IS NOT NULL
      AND p.supplier_id = purchase_orders.supplier_id
      AND p.company_id = purchase_orders.company_id
  )
);

CREATE OR REPLACE FUNCTION public.guard_supplier_purchase_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_supplier boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.profile_type = 'supplier'
  ) INTO v_is_supplier;

  IF NOT v_is_supplier THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.supplier_name IS DISTINCT FROM OLD.supplier_name
     OR NEW.supplier_cnpj IS DISTINCT FROM OLD.supplier_cnpj
     OR NEW.payment_condition IS DISTINCT FROM OLD.payment_condition
     OR NEW.delivery_days IS DISTINCT FROM OLD.delivery_days
     OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
     OR NEW.quotation_code IS DISTINCT FROM OLD.quotation_code
     OR NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
     OR NEW.requisition_code IS DISTINCT FROM OLD.requisition_code
     OR NEW.total_price IS DISTINCT FROM OLD.total_price
     OR NEW.observations IS DISTINCT FROM OLD.observations
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.external_code IS DISTINCT FROM OLD.external_code
     OR NEW.erp_error_message IS DISTINCT FROM OLD.erp_error_message
  THEN
    RAISE EXCEPTION 'Fornecedor não pode alterar campos protegidos do pedido';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       OLD.status = 'sent'
       AND NEW.status IN ('processing', 'refused')
     )
  THEN
    RAISE EXCEPTION 'Transição de status não permitida para o fornecedor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_supplier_po_update ON public.purchase_orders;
CREATE TRIGGER trg_guard_supplier_po_update
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_supplier_purchase_order_update();
