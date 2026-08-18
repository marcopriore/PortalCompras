-- Erro retornado pelo ERP na integração outbound do pedido
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS erp_error_message text;
