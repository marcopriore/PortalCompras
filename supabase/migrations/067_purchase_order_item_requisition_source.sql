-- Vínculo opcional de linha do pedido com item de requisição (pedido manual multi-REQ)
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS requisition_item_id uuid REFERENCES public.requisition_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_requisition_code text;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_requisition_item_id
  ON public.purchase_order_items (requisition_item_id)
  WHERE requisition_item_id IS NOT NULL;
