-- Prazo por linha do pedido (maior prazo usado no portal do fornecedor)
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS delivery_days integer;
